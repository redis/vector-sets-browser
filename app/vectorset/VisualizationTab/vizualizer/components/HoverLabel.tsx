interface HoverLabelProps {
    visible: boolean
    text: string
    x: number
    y: number
}

export function HoverLabel({ visible, text, x, y }: HoverLabelProps) {
    if (!visible) return null

    return (
        <div
            className="hover-label"
            style={{
                position: "fixed",
                left: `${x}px`,
                top: `${y}px`,
                maxWidth: "400px",
                transform: `translate(${
                    x + 250 > window.innerWidth ? "-110%" : "20px"
                }, ${y + 50 > window.innerHeight ? "-100%" : "-50%"})`,
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
            }}
        >
            {text}
            <style jsx>{`
                .hover-label {
                    background-color: rgba(0, 0, 0, 0.95);
                    color: white;
                    padding: 10px 14px;
                    border-radius: 6px;
                    z-index: 20;
                    font-family: monospace;
                    font-size: 15px;
                    word-break: break-all;
                    pointer-events: none;
                    transition: opacity 0.2s ease, transform 0.1s ease;
                    white-space: nowrap;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
            `}</style>
        </div>
    )
}
