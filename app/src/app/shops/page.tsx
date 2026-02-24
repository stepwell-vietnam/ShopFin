'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
    Store,
    Plus,
    Trash2,
    X,
    ArrowRight,
} from 'lucide-react';

interface Shop {
    id: string;
    name: string;
    platform: string;
    description: string | null;
    createdAt: string;
    monthlyData: Array<{
        month: string;
        dataType: string;
        totalRevenue: number;
        totalOrders: number;
        uploadedAt: string;
    }>;
}

export default function ShopsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [shops, setShops] = useState<Shop[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formPlatform, setFormPlatform] = useState<'shopee' | 'tiktok'>('shopee');
    const [formDesc, setFormDesc] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    const fetchShops = useCallback(async () => {
        setLoading(true);
        const r = await fetch('/api/shops');
        const data = await r.json();
        setShops(Array.isArray(data) ? data : []);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (status === 'authenticated') fetchShops();
    }, [status, fetchShops]);

    const handleCreate = async () => {
        if (!formName.trim()) return;
        setSaving(true);
        await fetch('/api/shops', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: formName, platform: formPlatform, description: formDesc || null }),
        });
        setShowForm(false);
        setFormName('');
        setFormDesc('');
        setSaving(false);
        fetchShops();
    };

    const handleDelete = async (id: string) => {
        await fetch(`/api/shops/${id}`, { method: 'DELETE' });
        setDeleteId(null);
        fetchShops();
    };

    if (status === 'loading' || loading) {
        return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>;
    }
    if (!session) return null;

    const fmt = (n: number) => n.toLocaleString('vi-VN');

    return (
        <div style={{ padding: '24px 32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                        <Store style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} size={24} />
                        Gian hàng ({shops.length}/10)
                    </h1>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Quản lý gian hàng Shopee & TikTok
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    disabled={shops.length >= 10}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '10px 20px', borderRadius: 10,
                        background: shops.length >= 10 ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                        color: '#fff', border: 'none', fontSize: '0.85rem',
                        fontWeight: 600, cursor: shops.length >= 10 ? 'not-allowed' : 'pointer',
                    }}
                >
                    <Plus size={18} /> Tạo gian hàng
                </button>
            </div>

            {/* Create Shop Modal */}
            {showForm && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 50,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} onClick={() => setShowForm(false)}>
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 14, padding: '28px', width: '100%', maxWidth: 440,
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Tạo gian hàng mới</h3>
                            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Platform toggle */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Nền tảng</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {(['shopee', 'tiktok'] as const).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setFormPlatform(p)}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: 8,
                                            border: `2px solid ${formPlatform === p ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                            background: formPlatform === p ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                                        }}
                                    >
                                        <img src={p === 'shopee' ? '/logo-shopee.png' : '/logo-tiktok.png'} alt={p} style={{ width: 18, height: 18, objectFit: 'contain', marginRight: 4, verticalAlign: 'middle' }} /> {p === 'shopee' ? 'Shopee' : 'TikTok'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Name */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Tên gian hàng</label>
                            <input
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                placeholder="VD: Dép Birken HCM"
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: 8,
                                    border: '1px solid var(--border-default)',
                                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                    fontSize: '0.88rem', outline: 'none',
                                }}
                            />
                        </div>

                        {/* Description */}
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Mô tả (tuỳ chọn)</label>
                            <input
                                value={formDesc}
                                onChange={e => setFormDesc(e.target.value)}
                                placeholder="VD: Gian hàng chính tại TP.HCM"
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: 8,
                                    border: '1px solid var(--border-default)',
                                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                    fontSize: '0.88rem', outline: 'none',
                                }}
                            />
                        </div>

                        <button
                            onClick={handleCreate}
                            disabled={saving || !formName.trim()}
                            style={{
                                width: '100%', padding: '12px', borderRadius: 10,
                                background: 'var(--accent-primary)', color: '#fff',
                                border: 'none', fontSize: '0.9rem', fontWeight: 600,
                                cursor: saving ? 'wait' : 'pointer',
                                opacity: saving || !formName.trim() ? 0.5 : 1,
                            }}
                        >
                            {saving ? 'Đang tạo...' : 'Tạo gian hàng'}
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {deleteId && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 50,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} onClick={() => setDeleteId(null)}>
                    <div style={{
                        background: 'var(--bg-secondary)', borderRadius: 14, padding: '28px', maxWidth: 380,
                        border: '1px solid var(--border-default)',
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                            Xác nhận xóa
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
                            Xóa gian hàng này sẽ xóa toàn bộ dữ liệu đã upload. Hành động không thể hoàn tác.
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setDeleteId(null)} style={{
                                flex: 1, padding: '10px', borderRadius: 8,
                                border: '1px solid var(--border-default)',
                                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                fontSize: '0.85rem', cursor: 'pointer',
                            }}>Hủy</button>
                            <button onClick={() => handleDelete(deleteId)} style={{
                                flex: 1, padding: '10px', borderRadius: 8,
                                border: 'none', background: '#ef4444', color: '#fff',
                                fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                            }}>Xóa</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Shop Cards */}
            {shops.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '60px 0',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 12,
                }}>
                    <Store size={48} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 16 }} />
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Chưa có gian hàng nào</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Nhấn <strong>&quot;Tạo gian hàng&quot;</strong> để bắt đầu</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {shops.map(shop => {
                        const rev = shop.monthlyData.filter(m => m.dataType === 'income').reduce((s, m) => s + m.totalRevenue, 0);
                        const orders = shop.monthlyData.filter(m => m.dataType === 'orders').reduce((s, m) => s + m.totalOrders, 0);
                        const months = new Set(shop.monthlyData.map(m => m.month)).size;
                        return (
                            <div key={shop.id} style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 12, overflow: 'hidden',
                            }}>
                                {/* Header */}
                                <div style={{
                                    padding: '16px 16px 12px',
                                    background: shop.platform === 'shopee'
                                        ? 'linear-gradient(135deg, rgba(238,77,45,0.1), rgba(255,107,74,0.05))'
                                        : 'linear-gradient(135deg, rgba(0,242,234,0.1), rgba(255,0,80,0.05))',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                }}>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 10,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            overflow: 'hidden',
                                        }}>
                                            <img src={shop.platform === 'shopee' ? '/logo-shopee.png' : '/logo-tiktok.png'} alt={shop.platform} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{shop.name}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                {shop.platform.toUpperCase()} · {months} tháng
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setDeleteId(shop.id)}
                                        title="Xóa gian hàng"
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'var(--text-muted)', padding: 4,
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {/* Stats */}
                                <div style={{ padding: '12px 16px', display: 'flex', gap: 16 }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Doanh thu</div>
                                        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(rev)}đ</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Đơn hàng</div>
                                        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(orders)}</div>
                                    </div>
                                </div>

                                {/* Action */}
                                <div style={{ padding: '0 16px 14px' }}>
                                    <button
                                        onClick={() => router.push(`/shops/${shop.id}`)}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                            padding: '10px', borderRadius: 8,
                                            border: '1px solid var(--border-default)',
                                            background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                            fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
                                        }}
                                    >
                                        Chi tiết <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
