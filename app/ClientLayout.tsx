"use client"

import { Toaster } from "sonner"
import TopNav from "./TopNav"

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode
}) {

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <TopNav/>
            <div className="flex-1">
                {children}
            </div>
            <Toaster />
        </div>
    )
} 