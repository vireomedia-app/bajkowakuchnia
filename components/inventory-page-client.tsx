'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ProductsList } from '@/components/products-list'
import { AddProductModal } from '@/components/add-product-modal'
import { BarcodeScanner } from '@/components/barcode-scanner'
import { ExportButton } from '@/components/export-button'
import { SearchProducts } from '@/components/search-products'
import { BackupManager } from '@/components/backup-manager'
import { LogoutButton } from '@/components/logout-button'
import { Warehouse, Package, ArrowLeft, Plus, Camera, Bluetooth, Keyboard, Pencil, Trash2, X, Check } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Product } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { isValidBarcode, getBarcodeValidationError, generateUnknownProductName } from '@/lib/barcode'

interface InventoryPageClientProps {
  products: Product[]
  searchQuery: string
  addProductName?: string
}

export function InventoryPageClient({ products, searchQuery: initialSearchQuery, addProductName }: InventoryPageClientProps) {
  const router = useRouter()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [initialProductName, setInitialProductName] = useState('')
  const [scannedProductData, setScannedProductData] = useState<any>(null)
  
  // Client-side search state
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '')
  
  // Filter products client-side (by name, unit, or barcode fragment)
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products
    const q = searchQuery.toLowerCase().trim()
    return products.filter(product => 
      product.name.toLowerCase().includes(q) ||
      product.unit.toLowerCase().includes(q) ||
      (product.barcode && product.barcode.includes(q))
    )
  }, [products, searchQuery])
  
  // Scan method selection
  const [showScanMethodDialog, setShowScanMethodDialog] = useState(false)
  const [scanMethodFor, setScanMethodFor] = useState<'add' | 'scan'>('add')
  
  // Bluetooth scanner state
  const [showBluetoothScanner, setShowBluetoothScanner] = useState(false)
  const [bluetoothBarcode, setBluetoothBarcode] = useState('')
  const [isSearchingBluetooth, setIsSearchingBluetooth] = useState(false)
  const bluetoothInputRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const lastKeyTime = useRef(0)
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Auto-open modal when add_product parameter is present
  useEffect(() => {
    if (addProductName) {
      setInitialProductName(decodeURIComponent(addProductName))
      setIsAddModalOpen(true)
      
      // Remove the parameter from URL after opening modal
      const url = new URL(window.location.href)
      url.searchParams.delete('add_product')
      window.history.replaceState({}, '', url.toString())
    }
  }, [addProductName])

  // Check for scanned product data from URL parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const openAddProduct = params.get('openAddProduct')
      const fromScanner = params.get('fromScanner')
      
      if (openAddProduct === 'true' && fromScanner === 'true') {
        // Get scanned product data from sessionStorage
        const scannedData = sessionStorage.getItem('scannedProduct')
        if (scannedData) {
          try {
            const productData = JSON.parse(scannedData)
            setScannedProductData(productData)
            setIsAddModalOpen(true)
            
            // Clean up
            sessionStorage.removeItem('scannedProduct')
            
            // Remove parameters from URL
            const url = new URL(window.location.href)
            url.searchParams.delete('openAddProduct')
            url.searchParams.delete('fromScanner')
            window.history.replaceState({}, '', url.toString())
          } catch (error) {
            console.error('Error parsing scanned product data:', error)
          }
        }
      }
    }
  }, [])

  const handleCloseModal = () => {
    setIsAddModalOpen(false)
    setInitialProductName('')
    setScannedProductData(null)
  }
  
  const handleScanSuccess = (productData: any) => {
    setScannedProductData(productData)
    setIsAddModalOpen(true)
  }
  
  const handleScanNext = () => {
    // Uruchom skaner ponownie
    setIsScannerOpen(true)
  }
  
  // Bluetooth scanner focus
  const focusBluetoothInput = useCallback(() => {
    setTimeout(() => {
      if (bluetoothInputRef.current) {
        bluetoothInputRef.current.focus()
        bluetoothInputRef.current.select()
      }
    }, 100)
  }, [])
  
  // Bluetooth keyboard handler
  useEffect(() => {
    if (!showBluetoothScanner) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now()
      if (now - lastKeyTime.current > 100) {
        barcodeBuffer.current = ''
      }
      lastKeyTime.current = now

      if (e.key === 'Enter') {
        e.preventDefault()
        const barcode = barcodeBuffer.current.trim() || bluetoothBarcode.trim()
        if (barcode) {
          handleBluetoothScan(barcode)
          barcodeBuffer.current = ''
          setBluetoothBarcode('')
        }
        return
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBuffer.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showBluetoothScanner, bluetoothBarcode])
  
  // Bluetooth scan handler
  const handleBluetoothScan = async (barcode: string) => {
    if (!barcode || isSearchingBluetooth) return
    
    // Validate barcode format
    if (!isValidBarcode(barcode)) {
      toast.error('Nieprawidłowy kod kreskowy: ' + getBarcodeValidationError(barcode))
      focusBluetoothInput()
      return
    }
    
    setIsSearchingBluetooth(true)
    
    try {
      const response = await fetch(`/api/products/barcode?code=${encodeURIComponent(barcode)}`)
      const data = await response.json()
      
      if (response.status === 409) {
        toast.info(`Produkt już istnieje w bazie: "${data.existingProduct?.name}"`)
      } else if (response.ok) {
        setScannedProductData({ ...data, barcode })
        setShowBluetoothScanner(false)
        setIsAddModalOpen(true)
        toast.success(`Znaleziono: ${data.name}`)
      } else {
        setScannedProductData({ barcode, name: generateUnknownProductName(), _notInDatabase: true })
        setShowBluetoothScanner(false)
        setIsAddModalOpen(true)
        toast.info('Produkt nie znaleziony - wypełnij dane ręcznie')
      }
    } catch (error) {
      toast.error('Błąd podczas skanowania')
    } finally {
      setIsSearchingBluetooth(false)
      focusBluetoothInput()
    }
  }
  
  // Open scan method dialog
  const openScanMethodDialog = (purpose: 'add' | 'scan') => {
    setScanMethodFor(purpose)
    setShowScanMethodDialog(true)
  }
  
  // Handle scan method selection
  const handleScanMethodSelect = (method: 'camera' | 'bluetooth' | 'manual') => {
    setShowScanMethodDialog(false)
    if (method === 'camera') {
      setIsScannerOpen(true)
    } else if (method === 'bluetooth') {
      setShowBluetoothScanner(true)
      setTimeout(() => focusBluetoothInput(), 200)
    } else {
      setIsAddModalOpen(true)
    }
  }
  
  // Edit mode handlers
  const toggleEditMode = () => {
    if (isEditMode) {
      setSelectedProducts(new Set())
    }
    setIsEditMode(!isEditMode)
  }
  
  const toggleProductSelection = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }
  
  const selectAllProducts = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)))
    }
  }
  
  const handleDeleteSelected = async () => {
    if (selectedProducts.size === 0) return
    setIsDeleting(true)
    
    let deleted = 0
    let errors = 0
    
    for (const productId of selectedProducts) {
      try {
        const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
        if (response.ok) {
          deleted++
        } else {
          errors++
        }
      } catch {
        errors++
      }
    }
    
    setIsDeleting(false)
    setShowDeleteConfirm(false)
    setSelectedProducts(new Set())
    setIsEditMode(false)
    
    if (deleted > 0) {
      toast.success(`Usunięto ${deleted} produktów`)
      router.refresh()
    }
    if (errors > 0) {
      toast.error(`Nie udało się usunąć ${errors} produktów`)
    }
  }

  return (
    <div className="space-y-8">
      {/* Back Button and Logout */}
      <div className="flex justify-between items-center">
        <Link href="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Powrót do menu głównego
          </Button>
        </Link>
        <LogoutButton />
      </div>

      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white mb-4">
          <Warehouse className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900">
          Kartoteka Magazynowa
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Kompleksowe narzędzie do śledzenia stanów magazynowych i historii transakcji dla wszystkich produktów w firmie.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        <SearchProducts value={searchQuery} onChange={setSearchQuery} />
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button 
            onClick={() => openScanMethodDialog('scan')} 
            className="gap-2 bg-purple-600 hover:bg-purple-700 whitespace-nowrap order-1 sm:order-1"
          >
            <Camera className="w-4 h-4" />
            Skanuj nowe produkty
          </Button>
          <Button 
            onClick={() => openScanMethodDialog('add')} 
            className="gap-2 bg-blue-600 hover:bg-blue-700 whitespace-nowrap order-2 sm:order-2"
          >
            <Plus className="w-4 h-4" />
            Dodaj nowy produkt
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">
                {searchQuery ? 'Znaleziono produktów' : 'Łączna liczba produktów'}
              </p>
              <p className="text-2xl font-bold text-gray-900">{filteredProducts?.length || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Produkty z dodatnim stanem</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredProducts?.filter(p => (p?.currentStock ?? 0) > 0)?.length || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Package className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Produkty bez stanu</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredProducts?.filter(p => (p?.currentStock ?? 0) === 0)?.length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Products List */}
      <ProductsList 
        products={filteredProducts || []} 
        isEditMode={isEditMode}
        selectedProducts={selectedProducts}
        onToggleSelect={toggleProductSelection}
      />
      
      {/* Edit Mode Controls */}
      {isEditMode && selectedProducts.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50">
          <span className="font-medium">Zaznaczono: {selectedProducts.size}</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={selectAllProducts}
            className="text-white hover:bg-red-700"
          >
            {selectedProducts.size === filteredProducts.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowDeleteConfirm(true)}
            className="text-white hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Usuń
          </Button>
        </div>
      )}
      
      {/* Bottom Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4 pb-8">
        <Button 
          onClick={toggleEditMode}
          variant={isEditMode ? "destructive" : "outline"}
          className="gap-2"
        >
          {isEditMode ? (
            <>
              <X className="w-4 h-4" />
              Zakończ edycję
            </>
          ) : (
            <>
              <Pencil className="w-4 h-4" />
              Edytuj listę
            </>
          )}
        </Button>
        <BackupManager />
        <ExportButton />
      </div>

      {/* Add Product Modal */}
      <AddProductModal 
        isOpen={isAddModalOpen} 
        onClose={handleCloseModal}
        initialName={initialProductName}
        initialData={scannedProductData}
        onScanNext={handleScanNext}
      />
      
      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
      
      {/* Scan Method Selection Dialog */}
      <Dialog open={showScanMethodDialog} onOpenChange={setShowScanMethodDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Wybierz metodę skanowania</DialogTitle>
            <DialogDescription>
              Jak chcesz dodać produkt do kartoteki?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button
              onClick={() => handleScanMethodSelect('camera')}
              className="w-full justify-start gap-3 h-14 bg-purple-600 hover:bg-purple-700"
            >
              <Camera className="w-6 h-6" />
              <div className="text-left">
                <div className="font-medium">Aparat (kamera)</div>
                <div className="text-xs opacity-80">Skanuj kodem kreskowym z kamery telefonu</div>
              </div>
            </Button>
            <Button
              onClick={() => handleScanMethodSelect('bluetooth')}
              className="w-full justify-start gap-3 h-14 bg-orange-600 hover:bg-orange-700"
            >
              <Bluetooth className="w-6 h-6" />
              <div className="text-left">
                <div className="font-medium">Skaner Bluetooth</div>
                <div className="text-xs opacity-80">Użyj zewnętrznego skanera laserowego</div>
              </div>
            </Button>
            <Button
              onClick={() => handleScanMethodSelect('manual')}
              variant="outline"
              className="w-full justify-start gap-3 h-14"
            >
              <Keyboard className="w-6 h-6" />
              <div className="text-left">
                <div className="font-medium">Wpisz ręcznie</div>
                <div className="text-xs text-gray-500">Wprowadź dane produktu bez skanowania</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Bluetooth Scanner Dialog */}
      <Dialog open={showBluetoothScanner} onOpenChange={setShowBluetoothScanner}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bluetooth className="w-5 h-5 text-orange-600" />
              Skaner Bluetooth
            </DialogTitle>
            <DialogDescription>
              Zeskanuj kod kreskowy produktu lub wpisz go ręcznie.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex gap-2 items-center p-4 bg-orange-50 rounded-lg border border-orange-200">
              <Input
                ref={bluetoothInputRef}
                value={bluetoothBarcode}
                onChange={(e) => setBluetoothBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const barcode = bluetoothBarcode.trim()
                    if (barcode) {
                      handleBluetoothScan(barcode)
                      setBluetoothBarcode('')
                    }
                  }
                }}
                placeholder="Zeskanuj lub wpisz kod..."
                className="font-mono text-lg flex-1"
                disabled={isSearchingBluetooth}
                autoFocus
              />
              {isSearchingBluetooth && (
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <p className="text-sm text-gray-500 text-center mt-3">
              Skaner automatycznie wykryje zeskanowany kod
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBluetoothScanner(false)}>
              Anuluj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potwierdzenie usunięcia</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć {selectedProducts.size} {selectedProducts.size === 1 ? 'produkt' : 'produktów'}?
              Ta operacja jest nieodwracalna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Usuwanie...' : 'Usuń'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
