
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ 
    success: true, 
    message: 'Wylogowano pomyślnie' 
  });
  
  // Usuń cookie sesji
  response.cookies.delete('auth_session');
  
  return response;
}
