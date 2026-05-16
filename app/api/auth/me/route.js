import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

export async function GET(request) {
  try {
    const token = request.cookies.get('cr_session')?.value;
    if (!token) {
      return NextResponse.json({ username: '', role: '' });
    }

    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) {
      return NextResponse.json({ username: '', role: '' });
    }

    const secret = process.env.SESSION_SECRET || 'fallback';
    const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64');
    if (expectedSig !== sig) {
      return NextResponse.json({ username: '', role: '' });
    }

    const data = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    if (data.exp < Date.now()) {
      return NextResponse.json({ username: '', role: '' });
    }

    return NextResponse.json({ username: data.username, role: data.role });
  } catch {
    return NextResponse.json({ username: '', role: '' });
  }
}
