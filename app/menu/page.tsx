
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ChefHat, BookOpen, PlusCircle, CalendarDays, Settings } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BackupManager } from '@/components/backup-manager'
import { ExportRecipesButton } from '@/components/export-recipes-button'
import { LogoutButton } from '@/components/logout-button'

export default function MenuPage() {
  return (
    <div className="space-y-8">
      {/* Back Button and Action Buttons */}
      <div className="flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Powrót do menu głównego
          </Button>
        </Link>
        
        <div className="flex items-center gap-3">
          <BackupManager />
          <ExportRecipesButton />
          <LogoutButton />
        </div>
      </div>

      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-600 to-green-700 text-white mb-4">
          <ChefHat className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900">
          Moduł Jadłospisu
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Zarządzaj recepturami, twórz jadłospisy i planuj posiłki
        </p>
      </div>

      {/* Menu Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-12">
        {/* Jadłospisy tygodniowe */}
        <Link href="/menu/meal-plans">
          <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group border-2 hover:border-green-500 h-full">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-600 to-green-700 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <CalendarDays className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-2xl">Jadłospisy tygodniowe</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-base">
                Twórz i zarządzaj jadłospisami, organizuj posiłki według dni tygodnia.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        {/* Normy żywieniowe */}
        <Link href="/menu/standards">
          <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group border-2 hover:border-purple-500 h-full">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Settings className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-2xl">Normy żywieniowe</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-base">
                Zarządzaj normami wartości odżywczych dla różnych grup wiekowych.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        {/* Receptury posiłków */}
        <Link href="/menu/recipes">
          <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group border-2 hover:border-orange-500 h-full">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-2xl">Receptury posiłków</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-base">
                Przeglądaj listę wszystkich dostępnych receptur wraz z wartościami odżywczymi.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        {/* Stwórz recepturę */}
        <Link href="/menu/recipes/new">
          <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group border-2 hover:border-blue-500 h-full">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <PlusCircle className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-2xl">Stwórz recepturę</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-base">
                Dodaj nową recepturę ze składnikami i wartościami odżywczymi.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}

