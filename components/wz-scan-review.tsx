'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Search,
  Package,
  Loader2,
  Trash2,
  Camera,
  Upload,
  X,
  ArrowLeft,
  Check,
  ScanLine,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { AddProductModal } from '@/components/add-product-modal'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Suggestion {
  id: string
  name: string
  unit: string
  score: number
}

interface MatchedItem {
  rawName: string
  quantity: number
  unit: string
  matchedProductId: string | null
  matchedProductName: string | null
  matchedProductUnit: string | null
  confidence: 'exact' | 'partial' | 'none'
  suggestions: Suggestion[]
}

interface ReviewItem extends MatchedItem {
  /** User-editable quantity */
  editedQuantity: string
  /** User-editable unit */
  editedUnit: string
  /** Currently selected product (may differ from initial match) */
  selectedProductId: string | null
  selectedProductName: string | null
  /** Whether user wants to include this item */
  included: boolean
  /** Is the search dropdown open? */
  searchOpen: boolean
  /** Search query for product picker */
  searchQuery: string
  /** Search results from API */
  searchResults: SearchProduct[]
  /** Loading search */
  isSearching: boolean
}

interface SearchProduct {
  id: string
  name: string
  unit: string
  currentStock: number
  barcode?: string | null
}

type WzStep = 'upload' | 'processing' | 'review'
type ProcessingPhase = 'ocr' | 'parsing'

interface WzScanReviewProps {
  /** Current document number from the parent */
  documentNumber: string
  /** Callback when document number is detected from WZ */
  onDocumentNumberDetected: (docNumber: string) => void
  /** Callback when user confirms items – receives list of verified items to add */
  onConfirm: (
    items: {
      productId: string
      productName: string
      quantity: number
      unit: string
    }[],
  ) => void
  /** Callback to go back / cancel */
  onCancel: () => void
}

// ---------------------------------------------------------------------------
// LocalStorage auto-save
// ---------------------------------------------------------------------------

const WZ_STORAGE_KEY = 'pending_wz_scan'

interface SavedWzState {
  items: ReviewItem[]
  documentNumber: string | null
  savedAt: string
}

// ---------------------------------------------------------------------------
// OCR helpers
// ---------------------------------------------------------------------------

/**
 * Light post-processing on raw OCR text to fix common artifacts.
 * We intentionally do NOT try to fix Polish diacritics here –
 * that's the LLM's job in the backend.
 */
function cleanOcrText(raw: string): string {
  return raw
    .replace(/\u201c|\u201d/g, '"') // smart double quotes → straight
    .replace(/\u2018|\u2019/g, "'") // smart single quotes → straight
    .replace(/\f/g, '\n') // form feed → newline
    .replace(/\r\n/g, '\n') // normalize line endings
    .replace(/[ \t]+/g, ' ') // collapse horizontal whitespace
    .replace(/\n{3,}/g, '\n\n') // collapse excessive blank lines
    .trim()
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WzScanReview({
  documentNumber,
  onDocumentNumberDetected,
  onConfirm,
  onCancel,
}: WzScanReviewProps) {
  const [step, setStep] = useState<WzStep>('upload')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // OCR progress state
  const [ocrProgress, setOcrProgress] = useState(0)
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('ocr')
  const [ocrStatusText, setOcrStatusText] = useState('')

  // Keep a ref to the tesseract worker so we can clean up on unmount
  const ocrWorkerRef = useRef<any>(null)

  // "Add new product" modal state – tracks which item index triggered it
  const [addProductForIndex, setAddProductForIndex] = useState<number | null>(null)
  const addProductForIndexRef = useRef<number | null>(null)

  // localStorage restore prompt
  const [showRestorePrompt, setShowRestorePrompt] = useState(false)
  const [savedState, setSavedState] = useState<SavedWzState | null>(null)

  // Keep ref in sync so the event listener always sees the latest value
  useEffect(() => {
    addProductForIndexRef.current = addProductForIndex
  }, [addProductForIndex])

  // ---- LocalStorage: check for saved state on mount ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WZ_STORAGE_KEY)
      if (raw) {
        const parsed: SavedWzState = JSON.parse(raw)
        if (parsed.items && parsed.items.length > 0) {
          setSavedState(parsed)
          setShowRestorePrompt(true)
        }
      }
    } catch {
      // corrupted data – ignore
      localStorage.removeItem(WZ_STORAGE_KEY)
    }
  }, [])

  // ---- LocalStorage: save items whenever they change in review step ----
  useEffect(() => {
    if (step === 'review' && items.length > 0) {
      try {
        const state: SavedWzState = {
          items: items.map((it) => ({
            ...it,
            // strip transient fields to keep payload small
            searchResults: [],
            isSearching: false,
          })),
          documentNumber: documentNumber || null,
          savedAt: new Date().toISOString(),
        }
        localStorage.setItem(WZ_STORAGE_KEY, JSON.stringify(state))
      } catch {
        // storage full or unavailable – ignore
      }
    }
  }, [items, step, documentNumber])

  const handleRestore = () => {
    if (!savedState) return
    const restored = savedState.items.map((it) => ({
      ...it,
      searchResults: [] as SearchProduct[],
      isSearching: false,
      searchOpen: false,
      searchQuery: '',
    }))
    setItems(restored)
    if (savedState.documentNumber) {
      onDocumentNumberDetected(savedState.documentNumber)
    }
    setStep('review')
    setShowRestorePrompt(false)
    setSavedState(null)
  }

  const handleDiscardSaved = () => {
    localStorage.removeItem(WZ_STORAGE_KEY)
    setShowRestorePrompt(false)
    setSavedState(null)
  }

  // Cleanup OCR worker on unmount
  useEffect(() => {
    return () => {
      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate().catch(() => {})
        ocrWorkerRef.current = null
      }
    }
  }, [])

  // Listen for the global 'productAdded' event dispatched by AddProductModal
  useEffect(() => {
    const handleProductAdded = (e: Event) => {
      const customEvent = e as CustomEvent
      const idx = addProductForIndexRef.current
      if (idx !== null && customEvent.detail) {
        const product = customEvent.detail
        setItems((prev) =>
          prev.map((item, i) =>
            i === idx
              ? {
                  ...item,
                  selectedProductId: product.id,
                  selectedProductName: product.name,
                  editedUnit: product.unit || item.editedUnit,
                  confidence: 'exact' as const,
                  searchOpen: false,
                  searchQuery: '',
                  searchResults: [],
                  isSearching: false,
                }
              : item,
          ),
        )
        toast.success(`Produkt "${product.name}" przypisany do pozycji.`)
      }
    }

    window.addEventListener('productAdded', handleProductAdded)
    return () => window.removeEventListener('productAdded', handleProductAdded)
  }, [])

  // -------------------------------------------------------------------------
  // Upload, OCR (client-side), then send text to backend
  // -------------------------------------------------------------------------

  const handleFileSelect = async (file: File) => {
    if (!file) return

    // Create local preview (no upload to server)
    const previewUrl = URL.createObjectURL(file)
    setImagePreview(previewUrl)

    // Reset states
    setStep('processing')
    setProcessingPhase('ocr')
    setOcrProgress(0)
    setOcrStatusText('Ładowanie silnika OCR...')
    setError(null)

    try {
      // --- Phase 1: Client-side OCR with tesseract.js (pol+eng) ---
      // No image pre-processing: pass the raw file directly.
      const TesseractModule = await import('tesseract.js')
      const { createWorker } = TesseractModule
      const PSM = TesseractModule.PSM

      const worker = await createWorker('pol+eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          switch (m.status) {
            case 'loading tesseract core':
              setOcrStatusText('Ładowanie silnika OCR...')
              break
            case 'loading language traineddata':
              setOcrStatusText('Pobieranie danych językowych (pol+eng)...')
              setOcrProgress(Math.round(m.progress * 30)) // 0–30%
              break
            case 'initializing tesseract':
            case 'initializing api':
              setOcrStatusText('Inicjalizacja...')
              setOcrProgress(30)
              break
            case 'recognizing text':
              setOcrStatusText('Rozpoznawanie tekstu...')
              setOcrProgress(30 + Math.round(m.progress * 70)) // 30–100%
              break
          }
        },
      })

      // Configure Tesseract parameters for table-like documents
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessjs_create_hocr: '0',
        tessjs_create_tsv: '0',
      })

      ocrWorkerRef.current = worker

      // Pass raw file directly – no image pre-processing
      const { data } = await worker.recognize(file)
      await worker.terminate()
      ocrWorkerRef.current = null

      const rawText = data.text

      // Debug: log raw OCR output for troubleshooting
      console.log('[OCR] Raw text:', rawText)

      const ocrText = cleanOcrText(rawText)

      console.log(`[WzScanReview] OCR complete: ${ocrText.length} chars`)
      console.log(`[WzScanReview] First 500 chars:`, ocrText.substring(0, 500))

      if (ocrText.length < 10) {
        throw new Error(
          'OCR nie rozpoznał wystarczającej ilości tekstu. Spróbuj z wyraźniejszym zdjęciem.',
        )
      }

      // --- Phase 2: Send OCR text to backend for LLM parsing ---
      setProcessingPhase('parsing')
      setOcrStatusText('Analizowanie pozycji...')

      const response = await fetch('/api/deliveries/parse-wz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ocrText,
          originalFileName: file.name,
          documentNameHint: documentNumber || undefined,
        }),
      })

      const responseData: {
        documentNumber: string | null
        items: MatchedItem[]
        warning?: string
        error?: string
      } = await response.json()

      if (responseData.error && (!responseData.items || responseData.items.length === 0)) {
        throw new Error(responseData.error)
      }

      if (responseData.warning) {
        toast.warning(responseData.warning)
      }

      if (responseData.documentNumber && !documentNumber) {
        onDocumentNumberDetected(responseData.documentNumber)
      }

      const reviewItems: ReviewItem[] = (responseData.items || []).map((item) => ({
        ...item,
        editedQuantity: item.quantity > 0 ? item.quantity.toString() : '',
        editedUnit: item.unit,
        selectedProductId: item.matchedProductId,
        selectedProductName: item.matchedProductName,
        included: true,
        searchOpen: false,
        searchQuery: item.confidence === 'none' ? item.rawName : '',
        searchResults: [],
        isSearching: false,
      }))

      setItems(reviewItems)
      setStep('review')

      if (reviewItems.length === 0) {
        toast.warning('Nie wykryto żadnych pozycji. Spróbuj z wyraźniejszym zdjęciem.')
      } else {
        const matched = reviewItems.filter((i) => i.confidence !== 'none').length
        toast.success(`Wykryto ${reviewItems.length} pozycji. Dopasowano ${matched} do bazy.`)
      }
    } catch (err: any) {
      console.error('[WzScanReview] Error:', err)
      setError(err.message || 'Nie udało się przetworzyć zdjęcia.')
      setStep('upload')

      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate().catch(() => {})
        ocrWorkerRef.current = null
      }
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
    e.target.value = ''
  }

  // -------------------------------------------------------------------------
  // Item editing
  // -------------------------------------------------------------------------

  const updateItem = (index: number, updates: Partial<ReviewItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)))
  }

  const searchProducts = async (index: number, query: string) => {
    updateItem(index, { isSearching: true })

    if (query.length < 2) {
      updateItem(index, { searchResults: [], isSearching: false })
      return
    }

    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error()
      const data: SearchProduct[] = await response.json()

      setItems((prev) => {
        const current = prev[index]
        if (current?.selectedProductId) {
          return prev.map((item, i) => (i === index ? { ...item, isSearching: false } : item))
        }
        return prev.map((item, i) =>
          i === index ? { ...item, searchResults: data, isSearching: false } : item,
        )
      })
    } catch {
      updateItem(index, { searchResults: [], isSearching: false })
    }
  }

  const selectProduct = (index: number, product: SearchProduct) => {
    updateItem(index, {
      selectedProductId: product.id,
      selectedProductName: product.name,
      editedUnit: product.unit,
      confidence: 'exact',
      searchOpen: false,
      searchQuery: '',
      searchResults: [],
      isSearching: false,
    })
  }

  const clearProduct = (index: number) => {
    const item = items[index]
    updateItem(index, {
      selectedProductId: null,
      selectedProductName: null,
      confidence: 'none',
      searchResults: [],
      isSearching: false,
    })
    // Immediately search using current rawName so results appear
    if (item?.rawName && item.rawName.length >= 2) {
      setTimeout(() => searchProducts(index, item.rawName), 100)
    }
  }

  /** Insert a blank review item at the given position (for manually adding missing rows) */
  const insertBlankItem = (position: number) => {
    const blank: ReviewItem = {
      rawName: '',
      quantity: 0,
      unit: 'szt',
      matchedProductId: null,
      matchedProductName: null,
      matchedProductUnit: null,
      confidence: 'none',
      suggestions: [],
      editedQuantity: '',
      editedUnit: 'szt',
      selectedProductId: null,
      selectedProductName: null,
      included: true,
      searchOpen: true,
      searchQuery: '',
      searchResults: [],
      isSearching: false,
    }
    setItems((prev) => {
      const next = [...prev]
      next.splice(position, 0, blank)
      return next
    })
  }

  // -------------------------------------------------------------------------
  // Confirm
  // -------------------------------------------------------------------------

  const handleConfirm = () => {
    const validItems = items
      .filter((item) => {
        if (!item.included) return false
        if (!item.selectedProductId) return false
        if (!item.selectedProductName) return false
        const qty = parseFloat(item.editedQuantity)
        if (isNaN(qty) || qty <= 0) return false
        return true
      })
      .map((item) => ({
        productId: item.selectedProductId!,
        productName: item.selectedProductName!,
        quantity: parseFloat(item.editedQuantity),
        unit: item.editedUnit,
      }))

    if (validItems.length === 0) {
      toast.error('Brak pozycji do dodania. Przypisz produkty i uzupełnij ilości.')
      return
    }

    // Clear saved state on successful confirmation
    localStorage.removeItem(WZ_STORAGE_KEY)
    onConfirm(validItems)
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const confidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'exact':
        return <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
      case 'partial':
        return <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
      default:
        return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
    }
  }

  const confidenceLabel = (confidence: string) => {
    switch (confidence) {
      case 'exact':
        return 'Znaleziono'
      case 'partial':
        return 'Czy chodzi o...'
      default:
        return 'Nie znaleziono – dodaj produkt'
    }
  }

  const totalIncluded = items.filter(
    (i) => i.included && i.selectedProductId && parseFloat(i.editedQuantity) > 0,
  ).length

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-4">
      {/* ----------------------------------------------------------------- */}
      {/* STEP: Upload */}
      {/* ----------------------------------------------------------------- */}
      {step === 'upload' && (
        <div className="space-y-4">
          {/* Restore prompt */}
          {showRestorePrompt && savedState && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-amber-900">
                Znaleziono niedokończone skanowanie
              </p>
              <p className="text-xs text-amber-700">
                Zapisano {savedState.items.length}{' '}
                {savedState.items.length === 1 ? 'pozycję' : savedState.items.length < 5 ? 'pozycje' : 'pozycji'}
                {' '}({new Date(savedState.savedAt).toLocaleString('pl-PL')}).
                Czy chcesz je przywrócić?
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleRestore}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Przywróć
                </Button>
                <Button
                  onClick={handleDiscardSaved}
                  variant="outline"
                  size="sm"
                >
                  Zacznij od nowa
                </Button>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              📷 Zrób zdjęcie lub wgraj obraz dokumentu dostawy (WZ, Faktura VAT).
              System rozpozna tekst na urządzeniu, a następnie dopasuje pozycje do produktów w bazie.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={() => cameraInputRef.current?.click()}
              className="h-auto py-6 bg-green-600 hover:bg-green-700 flex flex-col items-center gap-2"
            >
              <Camera className="w-8 h-8" />
              <span className="font-semibold">Zrób zdjęcie</span>
              <span className="text-xs opacity-80">Aparat urządzenia</span>
            </Button>

            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="h-auto py-6 flex flex-col items-center gap-2 border-2 border-dashed"
            >
              <Upload className="w-8 h-8 text-gray-500" />
              <span className="font-semibold text-gray-700">Wgraj zdjęcie</span>
              <span className="text-xs text-gray-500">Z galerii lub pliku</span>
            </Button>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <Button onClick={onCancel} variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Wróć
          </Button>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* STEP: Processing (OCR + backend parsing) */}
      {/* ----------------------------------------------------------------- */}
      {step === 'processing' && (
        <div className="text-center py-8 space-y-4">
          {imagePreview && (
            <div className="mx-auto w-32 h-32 rounded-lg overflow-hidden border border-gray-200">
              <img
                src={imagePreview}
                alt="Podgląd dokumentu"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {processingPhase === 'ocr' ? (
            <>
              <ScanLine className="w-12 h-12 mx-auto text-blue-600 animate-pulse" />
              <div>
                <p className="text-gray-700 font-medium">{ocrStatusText}</p>
                <div className="mt-3 mx-auto w-56">
                  <div className="bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{ocrProgress}%</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="w-12 h-12 mx-auto text-blue-600 animate-spin" />
              <div>
                <p className="text-gray-700 font-medium">Analizowanie pozycji...</p>
                <p className="text-sm text-gray-500 mt-1">
                  Dopasowuję pozycje do produktów w bazie
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* STEP: Review */}
      {/* ----------------------------------------------------------------- */}
      {step === 'review' && (
        <div className="flex flex-col max-h-[70vh]">
          {/* Sticky header */}
          <div className="flex items-start gap-3 pb-3 flex-shrink-0">
            {imagePreview && (
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                <img src={imagePreview} alt="WZ" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">
                Wykryto {items.length}{' '}
                {items.length === 1 ? 'pozycję' : items.length < 5 ? 'pozycje' : 'pozycji'}
              </p>
              <p className="text-sm text-gray-500">
                Sprawdź dopasowania i ilości, potem kliknij &quot;Potwierdź&quot;
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-3 h-3" />
                  {items.filter((i) => i.confidence === 'exact').length} pewne
                </span>
                <span className="flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="w-3 h-3" />
                  {items.filter((i) => i.confidence === 'partial').length} częściowe
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-3 h-3" />
                  {items.filter((i) => i.confidence === 'none').length} brak
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep('upload')
                setItems([])
                setImagePreview(null)
                localStorage.removeItem(WZ_STORAGE_KEY)
              }}
              className="flex-shrink-0 text-gray-500"
            >
              <Camera className="w-4 h-4 mr-1" />
              Nowe
            </Button>
          </div>

          {/* Scrollable items list */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
            <div className="pb-1">
              {/* Insert divider before the first item */}
              <InsertDivider position={0} onInsert={insertBlankItem} />
              {items.map((item, index) => (
                <div key={index}>
                  <ReviewItemCard
                    item={item}
                    index={index}
                    rowNumber={index + 1}
                    onUpdate={updateItem}
                    onSearch={searchProducts}
                    onSelectProduct={selectProduct}
                    onClearProduct={clearProduct}
                    onAddNewProduct={(idx) => setAddProductForIndex(idx)}
                    confidenceIcon={confidenceIcon}
                    confidenceLabel={confidenceLabel}
                  />
                  {/* Insert divider after each item */}
                  <InsertDivider position={index + 1} onInsert={insertBlankItem} />
                </div>
              ))}
            </div>
          </div>

          {/* Sticky footer */}
          <div className="flex flex-col gap-2 pt-3 flex-shrink-0 border-t border-gray-100 mt-2">
            <Button
              onClick={handleConfirm}
              className="w-full bg-green-600 hover:bg-green-700 text-lg py-5"
              disabled={totalIncluded === 0}
            >
              <Check className="w-5 h-5 mr-2" />
              Potwierdź i dodaj ({totalIncluded}{' '}
              {totalIncluded === 1 ? 'pozycja' : totalIncluded < 5 ? 'pozycje' : 'pozycji'})
            </Button>
            <Button onClick={onCancel} variant="outline" className="w-full">
              <X className="w-4 h-4 mr-2" />
              Anuluj
            </Button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Nested AddProductModal (opens over the WZ review) */}
      {/* ----------------------------------------------------------------- */}
      <AddProductModal
        isOpen={addProductForIndex !== null}
        onClose={() => setAddProductForIndex(null)}
        initialName={
          addProductForIndex !== null ? items[addProductForIndex]?.rawName ?? '' : ''
        }
      />
    </div>
  )
}

// ===========================================================================
// Sub-component: Single review item card
// ===========================================================================

function ReviewItemCard({
  item,
  index,
  rowNumber,
  onUpdate,
  onSearch,
  onSelectProduct,
  onClearProduct,
  onAddNewProduct,
  confidenceIcon,
  confidenceLabel,
}: {
  item: ReviewItem
  index: number
  rowNumber: number
  onUpdate: (index: number, updates: Partial<ReviewItem>) => void
  onSearch: (index: number, query: string) => void
  onSelectProduct: (index: number, product: SearchProduct) => void
  onClearProduct: (index: number) => void
  onAddNewProduct: (index: number) => void
  confidenceIcon: (c: string) => JSX.Element
  confidenceLabel: (c: string) => string
}) {
  const rawNameDebounce = useRef<NodeJS.Timeout>()

  /** Live search: editing rawName auto-triggers product search when no product is selected */
  const handleRawNameChange = (value: string) => {
    onUpdate(index, { rawName: value })
    if (!item.selectedProductId) {
      if (rawNameDebounce.current) clearTimeout(rawNameDebounce.current)
      rawNameDebounce.current = setTimeout(() => onSearch(index, value), 300)
    }
  }

  // --- Excluded item (minimized) ---
  if (!item.included) {
    return (
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 opacity-50">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 bg-gray-200 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
              {rowNumber}
            </span>
            <span className="text-sm text-gray-500 line-through">
              {item.rawName || `Pozycja ${rowNumber}`}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUpdate(index, { included: true })}
            className="text-xs text-blue-600"
          >
            Przywróć
          </Button>
        </div>
      </div>
    )
  }

  // Determine if we should show live search results
  const showResults = !item.selectedProductId && item.searchResults.length > 0
  const showSuggestions =
    !item.selectedProductId &&
    item.searchResults.length === 0 &&
    !item.isSearching &&
    item.suggestions.length > 0
  const showNoResults =
    !item.selectedProductId &&
    item.rawName.length >= 2 &&
    !item.isSearching &&
    item.searchResults.length === 0 &&
    item.suggestions.length === 0

  // --- Active item ---
  return (
    <div
      className={`rounded-lg p-3 border-2 space-y-2 ${
        item.confidence === 'exact'
          ? 'border-green-200 bg-green-50/50'
          : item.confidence === 'partial'
            ? 'border-yellow-200 bg-yellow-50/50'
            : 'border-red-200 bg-red-50/50'
      }`}
    >
      {/* ---- Row 1: Row number + editable scanned name (live search) + delete ---- */}
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-bold text-gray-500 bg-gray-200 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
          {rowNumber}
        </span>
        {confidenceIcon(item.confidence)}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs text-gray-500">{confidenceLabel(item.confidence)}</p>
          {/* Editable rawName — typing here auto-searches the product DB */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <Input
              value={item.rawName}
              onChange={(e) => handleRawNameChange(e.target.value)}
              className="h-8 text-sm font-medium pl-7 pr-8"
              placeholder="Nazwa z dokumentu – wpisz aby wyszukać"
            />
            {item.isSearching && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUpdate(index, { included: false })}
          className="flex-shrink-0 text-gray-400 hover:text-red-500 h-7 w-7 p-0"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* ---- Row 2: Matched product OR search results / suggestions ---- */}
      <div className="space-y-1.5">
        {item.selectedProductId ? (
          /* === Product is selected (green state) === */
          <div className="flex items-center gap-2 bg-white rounded-md px-2 py-1.5 border border-green-300">
            <Package className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-800 flex-1 truncate">
              {item.selectedProductName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onClearProduct(index)}
              className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          /* === No product selected === */
          <>
            {/* Live search results (from rawName) */}
            {showResults && (
              <div className="bg-white border rounded-md max-h-36 overflow-y-auto">
                {item.searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => onSelectProduct(index, product)}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 transition-colors flex items-center gap-2 border-b last:border-b-0"
                  >
                    <Package className="w-3 h-3 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="text-gray-400">
                        Stan: {product.currentStock} {product.unit}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Backend suggestions (shown when no live search results yet) */}
            {showSuggestions && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Propozycje:</p>
                {item.suggestions.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    onClick={() =>
                      onSelectProduct(index, {
                        id: s.id,
                        name: s.name,
                        unit: s.unit,
                        currentStock: 0,
                      })
                    }
                    className="w-full text-left text-xs bg-white rounded px-2 py-1.5 border hover:bg-blue-50 transition-colors flex items-center gap-2"
                  >
                    <Package className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-gray-400">({s.score}%)</span>
                  </button>
                ))}
              </div>
            )}

            {/* No results message */}
            {showNoResults && (
              <p className="text-xs text-gray-400 text-center py-1">
                Brak wyników dla &quot;{item.rawName}&quot;
              </p>
            )}

            {/* "Add new product" button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddNewProduct(index)}
              className="w-full text-xs h-7 border-dashed text-blue-600 border-blue-300 hover:bg-blue-50"
            >
              <Plus className="w-3 h-3 mr-1" />
              Dodaj nowy produkt
            </Button>
          </>
        )}
      </div>

      {/* ---- Row 3: Quantity + Unit ---- */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={item.editedQuantity}
            onChange={(e) => onUpdate(index, { editedQuantity: e.target.value })}
            placeholder="Ilość"
            className="h-9 text-sm"
          />
        </div>
        <div className="w-24">
          <Input
            value={item.editedUnit}
            onChange={(e) => onUpdate(index, { editedUnit: e.target.value })}
            placeholder="jedn."
            className="h-9 text-sm text-center"
          />
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// Sub-component: Insert divider ("+ Dodaj brakującą pozycję")
// ===========================================================================

function InsertDivider({
  position,
  onInsert,
}: {
  position: number
  onInsert: (position: number) => void
}) {
  return (
    <div className="flex items-center gap-2 py-1 group">
      <div className="flex-1 border-t border-dashed border-gray-300 group-hover:border-blue-400 transition-colors" />
      <button
        type="button"
        onClick={() => onInsert(position)}
        className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full border border-dashed border-gray-300 hover:border-blue-400 transition-all whitespace-nowrap"
      >
        <Plus className="w-3 h-3" />
        <span className="hidden sm:inline">Dodaj brakującą pozycję</span>
        <span className="sm:hidden">Dodaj</span>
      </button>
      <div className="flex-1 border-t border-dashed border-gray-300 group-hover:border-blue-400 transition-colors" />
    </div>
  )
}
