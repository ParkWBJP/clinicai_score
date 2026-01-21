"use client";

import React from 'react';
import { translations } from '@/lib/i18n';

export default function Footer() {
    return (
        <footer style={{ padding: '40px 24px', borderTop: '1px solid #E5E7EB', marginTop: 'auto', backgroundColor: '#F9FAFB' }}>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#9CA3AF', fontSize: '14px' }}>
                <p>&copy; 2026 Clinic.ai. All rights reserved.</p>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <span>Terms</span>
                    <span>Privacy</span>
                </div>
            </div>
        </footer>
    );
}
