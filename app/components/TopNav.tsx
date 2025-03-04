import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface TopNavProps {
    redisUrl: string | null
    isConnected: boolean
    isConnecting: boolean
    onConnect: (url: string) => Promise<void>
    error: string | null
}

export default function TopNav({
    redisUrl,
    isConnected,
    isConnecting,
    onConnect,
    error,
}: TopNavProps) {
    const pathname = usePathname()

    const navItems = [
        { href: "/docs", label: "Docs", visible: true },
        { href: "/examples", label: "Examples", visible: true },

        { 
            href: "/config", 
            label: "Config", 
            visible: pathname?.includes("/vectorset") || pathname?.includes("/console") || pathname?.includes("/config")
        },
        { href: "/vectorset", label: "Console", visible: true },
    ]

    return (
        <header className="bg-white border-b sticky top-0 z-10">
            <div className="flex items-center p-2 space-x-4 pr-4">
                <a href="/" className="ml-2 flex items-center">
                    {/* Image with proper aspect ratio handling */}
                    <img
                        src="/Redis_logo.png"
                        alt="Redis Logo"
                        width={80}
                        className="mr-2"
                    />
                    <div>
                        <h1 className="text-xl font-bold">
                            VectorSet
                        </h1>
                    </div>
                </a>
                <div className="grow"></div>
                <nav className="flex items-center gap-4 pl-8">
                    {navItems.filter(({ visible }) => visible).map(({ href, label }) => (
                        <Link
                            key={href}
                            href={href}
                            className={` font-mono hover:text-gray-900 py-2 border-b-2 ${
                                pathname === href
                                    ? "border-red-500 text-red-600"
                                    : "border-transparent text-black"
                            }`}
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
                {/* <Button variant="default">
                    <Link href="/console" className="flex items-center gap-2">
                        Console
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </Button> */}
            </div>
        </header>
    )
}
