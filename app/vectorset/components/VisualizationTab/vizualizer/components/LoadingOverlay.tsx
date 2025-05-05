interface LoadingOverlayProps {
    isVisible: boolean
    message?: string
}

export function LoadingOverlay({
    isVisible,
    message = "Running projection...",
}: LoadingOverlayProps) {
    if (!isVisible) return null

    return (
        <div className="projection-loading">
            <div className="spinner"></div>
            <div className="loading-text">{message}</div>
            <style jsx>{`
                .projection-loading {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    z-index: 100;
                }
                .spinner {
                    border: 4px solid rgba(255, 255, 255, 0.3);
                    border-top: 4px solid white;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                }
                .loading-text {
                    color: white;
                    font-size: 18px;
                    margin-top: 20px;
                }
            `}</style>
        </div>
    )
}
