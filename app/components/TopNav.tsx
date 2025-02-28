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
        { href: "/home", label: "Home" },
        { href: "/docs", label: "Docs" },
        { href: "/config", label: "Config" },
    ]

    return (
        <header className="bg-white border-b">
            <div className="flex items-center p-2 space-x-2 pr-4">
                <div className="flex items-center">
                    {/* Set height to auto */}
                    <Image
                        priority
                        src="/Redis_logo.png"
                        alt="Redis Logo"
                        width={100}
                        height={100}
                        className="mr-2"
                    />
                    <div>
                        <h1 className="text-xl uppercase font-bold">
                            VectorSet
                        </h1>
                    </div>
                </div>
                <nav className="flex items-center gap-4 pl-8">
                    {navItems.map(({ href, label }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`uppercase font-bold hover:text-gray-900 py-2 border-b-2 ${
                                pathname === href
                                    ? "border-red-500 text-red-600"
                                    : "border-transparent text-black"
                            }`}
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
                <div className="grow"></div>
            </div>
        </header>
    )
}
