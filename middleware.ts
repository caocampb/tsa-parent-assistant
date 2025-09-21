import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory rate limiting (resets on deploy)
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export function middleware(request: NextRequest) {
  // Only protect expensive OpenAI endpoints
  if (!request.nextUrl.pathname.startsWith('/api/q') && 
      !request.nextUrl.pathname.startsWith('/api/documents')) {
    return NextResponse.next()
  }

  // Get IP address
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'
  
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const limit = 10 // 10 requests per minute per IP
  
  // Get or create request count for this IP
  const userRequests = requestCounts.get(ip) || { count: 0, resetTime: now + windowMs }
  
  // Reset if window expired
  if (now > userRequests.resetTime) {
    userRequests.count = 0
    userRequests.resetTime = now + windowMs
  }
  
  // Increment count
  userRequests.count++
  requestCounts.set(ip, userRequests)
  
  // Check limit
  if (userRequests.count > limit) {
    return new NextResponse('Too many requests. Please try again later.', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(userRequests.resetTime).toISOString(),
      },
    })
  }
  
  // Add rate limit headers to response
  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', limit.toString())
  response.headers.set('X-RateLimit-Remaining', (limit - userRequests.count).toString())
  response.headers.set('X-RateLimit-Reset', new Date(userRequests.resetTime).toISOString())
  
  return response
}

export const config = {
  matcher: '/api/:path*'
}
