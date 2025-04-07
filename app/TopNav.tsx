import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"

export default function TopNav() {
    const pathname = usePathname()

    const navItems = [
        { href: "/vectorset", paths: ["/vectorset", "/console"], label: "Console", visible: true },
        { href: "/calculator", paths: ["/calculator"], label: "Calculator", visible: true },
        { href: "/docs", paths: ["/docs"], label: "Docs", visible: true },
        {
            href: "/config",
            paths: ["/config"],
            label: "Settings",
            visible:
                pathname?.includes("/vectorset") ||
                pathname?.includes("/console") ||
                pathname?.includes("/config"),
        },
    ]

    return (
        <header className="bg-[white] border-b sticky top-0 z-10">
            <div className="flex items-center p-2 space-x-4 pr-4">
                <Link href="/" className="flex items-center gap-2">
                    <Image src="/logo.png" width={32} height={32} alt="Logo" />
                    <span className="font-semibold">Vector Sets Browser</span>
                </Link>
                <div className="grow"></div>
                <nav className="flex items-center gap-4 pl-8">
                    {navItems
                        .filter(({ visible }) => visible)
                        .map(({ href, paths, label }) => (
                            <Link key={href} href={href} legacyBehavior>
                                <div
                                    className={`font-mono hover:text-red-500 py-2 cursor-pointer border-b-2 ${paths.some((path) => pathname === path)
                                        ? "border-red-500 text-red-600"
                                        : "border-transparent text-black"
                                        }`}
                                >
                                    {label}
                                </div>
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
