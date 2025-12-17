import AppSidebar from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import React from "react";
import { Geist, Geist_Mono } from "next/font/google";
import AppSidebarNav from "@/components/app-sidebar-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      className={`${geistSans.className} ${geistMono.variable} h-dvh overflow-hidden`}
    >
      <AppSidebar intent="inset" collapsible="dock" />
      <SidebarInset className="overflow-hidden">
        <AppSidebarNav />
        <div className="flex-1 overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
