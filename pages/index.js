"use client";

import { useEffect, useState } from "react";

function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const savePrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Save the event so it can be triggered later
      setDeferredPrompt(e);
      // Update UI to show the install button
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", savePrompt);

    // Check if the app is already installed
    window.addEventListener("appinstalled", () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log("PWA was installed");
    });

    return () => window.removeEventListener("beforeinstallprompt", savePrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }

    // We can only use the prompt once, so clear it
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  // Only show the button if the browser says the app is installable
  if (!isInstallable) return null;

  return (
    <button
      onClick={handleInstallClick}
      style={{
        background: "linear-gradient(135deg, #2dd4a8, #1aab87)",
        color: "white",
        padding: "10px 20px",
        borderRadius: "10px",
        border: "none",
        fontWeight: "bold",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(45, 212, 168, 0.3)",
        margin: "10px 0"
      }}
    >
      📲 Install App
    </button>
  );
}
