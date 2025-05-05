"use client"

import { HeroSection } from "@/components/landing/HeroSection"
import { MainContentSection } from "@/components/landing/MainContentSection"
import { FeatureCardSection } from "@/components/landing/FeatureCardSection"
import { CallToAction } from "@/components/landing/CallToAction"

export default function Home() {
    return (
        <div className="flex min-h-screen flex-col bg-[white]">
            {/* Hero Section */}
            <HeroSection />
            
            {/* Main Content */}
            <MainContentSection />
            
            {/* Features Section */}
            <FeatureCardSection />
            
            {/* CTA Section */}
            <CallToAction />
        </div>
    )
}
