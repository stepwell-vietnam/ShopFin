'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        try {
            await signIn('google', { callbackUrl: '/dashboard' });
        } catch {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            padding: '20px',
        }}>
            <div style={{
                width: '100%',
                maxWidth: 420,
                background: 'var(--bg-secondary)',
                borderRadius: 16,
                border: '1px solid var(--border-default)',
                padding: '40px 32px',
                textAlign: 'center',
            }}>
                {/* Logo / Brand */}
                <div style={{
                    width: 64, height: 64,
                    background: 'linear-gradient(135deg, #2dd4bf, #818cf8)',
                    borderRadius: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                    fontSize: '1.8rem', fontWeight: 700, color: '#fff',
                }}>
                    S
                </div>

                <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: 8,
                }}>
                    ShopFin Pro
                </h1>
                <p style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    marginBottom: 32,
                    lineHeight: 1.5,
                }}>
                    Quản lý nhiều gian hàng · Báo cáo tổng hợp · Theo dõi doanh thu
                </p>

                {/* Google Login Button */}
                <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        padding: '14px 24px',
                        borderRadius: 12,
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        cursor: isLoading ? 'wait' : 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: isLoading ? 0.7 : 1,
                    }}
                    onMouseEnter={e => { if (!isLoading) (e.target as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = 'var(--bg-primary)'; }}
                >
                    {/* Google Icon */}
                    <svg width="20" height="20" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập bằng Google'}
                </button>

                {/* Divider */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    margin: '24px 0',
                }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>hoặc</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
                </div>

                {/* Guest mode link */}
                <a
                    href="/"
                    style={{
                        display: 'block',
                        padding: '12px',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        textDecoration: 'none',
                        borderRadius: 8,
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--accent-primary)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-secondary)'; }}
                >
                    Sử dụng miễn phí (không cần đăng nhập)
                </a>

                {/* Features list */}
                <div style={{
                    marginTop: 24,
                    padding: '16px',
                    background: 'var(--bg-primary)',
                    borderRadius: 10,
                    textAlign: 'left',
                }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                        Đăng nhập để sử dụng:
                    </div>
                    {[
                        '🏪 Tạo tối đa 10 gian hàng',
                        '📊 Lưu dữ liệu theo tháng',
                        '📈 Dashboard tổng hợp',
                        '🔄 So sánh giữa các gian hàng',
                    ].map((f, i) => (
                        <div key={i} style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            padding: '4px 0',
                        }}>
                            {f}
                        </div>
                    ))}
                </div>

                {/* Version */}
                <div style={{
                    marginTop: 20,
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    opacity: 0.5,
                }}>
                    ShopFin v3.0
                </div>
            </div>
        </div>
    );
}
