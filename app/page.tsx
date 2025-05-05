"use client"

import { HeroSection } from "@/app/HeroSection"
import { MainContentSection } from "@/app/MainContentSection"
import { FeatureCardSection } from "@/app/FeatureCardSection"
import { CallToAction } from "@/app/CallToAction"

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
