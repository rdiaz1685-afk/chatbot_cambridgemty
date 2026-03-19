import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  // Solo queremos proteger las rutas que empiecen con /admin
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const basicAuth = req.headers.get('authorization')
    
    // Si la petición contiene la cabecera de autorización...
    if (basicAuth) {
      // El header viene como "Basic base64(user:password)"
      const authValue = basicAuth.split(' ')[1]
      try {
        const [user, pwd] = atob(authValue).split(':')
        
        // Configuramos usuario y contraseña (las toma de tu .env.local, o usa las de defecto)
        const expectedUser = process.env.ADMIN_USER || 'admin'
        const expectedPwd = process.env.ADMIN_PASSWORD || 'cambridge123'
        
        if (user === expectedUser && pwd === expectedPwd) {
          return NextResponse.next() // Contraseña correcta, lo dejamos pasar
        }
      } catch (e) {
        console.error('Error al decodificar la contraseña (Basic Auth):', e)
      }
    }

    // Si la contraseña es incorrecta O no ha puesto contraseña,
    // devolvemos un 401. Esto hace que EL NAVEGADOR muestre la ventanita pop-up nativa.
    return new NextResponse('Acceso Protegido - Se requiere autenticación.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Panel de Administracion - Proveedores"',
      },
    })
  }

  // Dejamos pasar todo lo demás (el chatbot público, la página principal, etc.)
  return NextResponse.next()
}

// Configuración de Next.js para que el archivo Middleware se ejecute rápidamente en estas rutas
export const config = {
  matcher: ['/admin/:path*'],
}
