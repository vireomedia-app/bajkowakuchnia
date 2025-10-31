
// Lista 14 głównych alergenów zgodnie z przepisami UE

export interface Allergen {
  id: number
  name: string
  description: string
}

export const ALLERGENS: Allergen[] = [
  {
    id: 1,
    name: 'GLUTEN',
    description: 'Ziarna zbóż zawierające GLUTEN (pszenica, żyto, jęczmień, owies, orkisz, kamut) oraz produkty pochodne'
  },
  {
    id: 2,
    name: 'SKORUPIAKI',
    description: 'SKORUPIAKI i produkty pochodne'
  },
  {
    id: 3,
    name: 'JAJA',
    description: 'JAJA i produkty pochodne'
  },
  {
    id: 4,
    name: 'RYBY',
    description: 'RYBY i produkty pochodne'
  },
  {
    id: 5,
    name: 'ORZESZKI ZIEMNE',
    description: 'ORZESZKI ZIEMNE (arachidowe) i produkty pochodne'
  },
  {
    id: 6,
    name: 'SOJA',
    description: 'SOJA i produkty pochodne'
  },
  {
    id: 7,
    name: 'MLEKO',
    description: 'MLEKO i produkty pochodne (łącznie z laktozą)'
  },
  {
    id: 8,
    name: 'ORZECHY',
    description: 'ORZECHY (migdały, laskowe, włoskie, nerkowca, pekan, brazylijskie, pistacje, makadamia) i produkty pochodne'
  },
  {
    id: 9,
    name: 'SELER',
    description: 'SELER i produkty pochodne'
  },
  {
    id: 10,
    name: 'GORCZYCA',
    description: 'GORCZYCA i produkty pochodne'
  },
  {
    id: 11,
    name: 'SEZAM',
    description: 'NASIONA SEZAMU i produkty pochodne'
  },
  {
    id: 12,
    name: 'DWUTLENEK SIARKI',
    description: 'DWUTLENEK SIARKI i siarczyny w stężeniach powyżej 10 mg/kg lub 10 mg/l (SO₂)'
  },
  {
    id: 13,
    name: 'ŁUBIN',
    description: 'ŁUBIN i produkty pochodne'
  },
  {
    id: 14,
    name: 'MIĘCZAKI',
    description: 'MIĘCZAKI i produkty pochodne'
  }
]

// Funkcja formatująca alergeny do wyświetlania (A:1, A:2, itd.)
export function formatAllergens(allergenIds: number[]): string {
  if (!allergenIds || allergenIds.length === 0) return ''
  return allergenIds.sort((a, b) => a - b).map(id => `A:${id}`).join(', ')
}

// Funkcja pobierająca nazwy alergenów na podstawie ich ID
export function getAllergenNames(allergenIds: number[]): string[] {
  if (!allergenIds || allergenIds.length === 0) return []
  return allergenIds
    .sort((a, b) => a - b)
    .map(id => {
      const allergen = ALLERGENS.find(a => a.id === id)
      return allergen ? allergen.name : `A:${id}`
    })
}

// Funkcja pobierająca pełne opisy alergenów
export function getAllergenDescriptions(allergenIds: number[]): string[] {
  if (!allergenIds || allergenIds.length === 0) return []
  return allergenIds
    .sort((a, b) => a - b)
    .map(id => {
      const allergen = ALLERGENS.find(a => a.id === id)
      return allergen ? `A:${id} - ${allergen.description}` : `A:${id}`
    })
}
