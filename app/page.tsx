

import Link from 'next/link'
import Image from 'next/image'
import { Warehouse, ChefHat } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataManagement } from '@/components/data-management'
import { LogoutButton } from '@/components/logout-button'

export default function HomePage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-4xl w-full space-y-8">
        {/* Logout Button */}
        <div className="flex justify-end mb-4">
          <LogoutButton />
        </div>
        
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative w-full max-w-2xl mx-auto aspect-[4/1] mb-6">
            <Image
              src="/logo.png"
              alt="Bajkowy Dworek - Niepubliczne przedszkole w Chybiu"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            System zarządzania kuchnią i magazynem
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Wybierz moduł, z którego chcesz skorzystać
          </p>
        </div>

        {/* App Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          {/* Kartoteka Magazynowa */}
          <Link href="/inventory">
            <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group border-2 hover:border-blue-500 h-full">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Warehouse className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-2xl">Kartoteka Magazynowa</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-base">
                  Zarządzaj stanami magazynowymi, dodawaj produkty, 
                  śledź przychody i rozchody towarów.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          {/* Jadłospis */}
          <Link href="/menu">
            <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group border-2 hover:border-green-500 h-full">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-600 to-green-700 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ChefHat className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-2xl">Jadłospis</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-base">
                  Planuj posiłki, twórz przepisy, zarządzaj wartościami 
                  odżywczymi i kalkuluj koszty.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Data Management Section */}
        <DataManagement />
      </div>
    </div>
  )
}

