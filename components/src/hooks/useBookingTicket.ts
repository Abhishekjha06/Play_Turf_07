import { useRef, useCallback, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

export interface TicketData {
  bookingId: string;
  turfName: string;
  sport?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  amount: number;
  status: string;
  paymentId?: string | null;
  playerName?: string;
  hostName?: string;
  address?: string;
  paymentMethod?: string;
  slots?: string;
  bookedAt?: string;
  cancellationPolicy?: string;
}

export function useBookingTicket() {
  const [isGenerating, setIsGenerating] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  const captureElement = useCallback(async (element: HTMLElement): Promise<string> => {
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#0a0a0a",
      logging: false,
      imageTimeout: 15000,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.body.querySelector("[data-ticket-capture]");
        if (clonedEl) {
          (clonedEl as HTMLElement).style.display = "block";
          (clonedEl as HTMLElement).style.position = "relative";
          (clonedEl as HTMLElement).style.width = "600px";
          (clonedEl as HTMLElement).style.margin = "0";
        }
      },
    });
    return canvas.toDataURL("image/png", 1.0);
  }, []);

  const downloadPDF = useCallback(async (element?: HTMLElement, filename?: string) => {
    const target = element || ticketRef.current;
    if (!target) {
      toast.error("Ticket element not found");
      return;
    }

    setIsGenerating(true);
    try {
      const imgData = await captureElement(target);

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      const img = new Image();
      img.src = imgData;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      const imgWidth = img.width;
      const imgHeight = img.height;
      const availableWidth = pageWidth - margin * 2;
      const scale = availableWidth / imgWidth;
      const scaledHeight = imgHeight * scale;

      if (scaledHeight <= pageHeight - margin * 2) {
        pdf.addImage(imgData, "PNG", margin, margin, availableWidth, scaledHeight);
      } else {
        let position = margin;
        let sourceY = 0;
        const availableHeight = pageHeight - margin * 2;
        const pageImgHeight = availableHeight / scale;

        while (sourceY < imgHeight) {
          const remainingHeight = imgHeight - sourceY;
          const sliceHeight = Math.min(pageImgHeight, remainingHeight);

          const canvasSlice = document.createElement("canvas");
          canvasSlice.width = imgWidth;
          canvasSlice.height = sliceHeight;
          const ctx = canvasSlice.getContext("2d");
          if (ctx) {
            ctx.drawImage(
              img,
              0, sourceY, imgWidth, sliceHeight,
              0, 0, imgWidth, sliceHeight
            );
            const sliceData = canvasSlice.toDataURL("image/png");
            pdf.addImage(
              sliceData,
              "PNG",
              margin,
              position,
              availableWidth,
              sliceHeight * scale
            );
          }
          sourceY += sliceHeight;
          if (sourceY < imgHeight) {
            pdf.addPage();
          }
        }
      }

      const safeName = filename?.replace(/[^a-zA-Z0-9_-]/g, "_") || "PlayTurf-Booking";
      pdf.save(`${safeName}.pdf`);
      toast.success("PDF ticket downloaded successfully!");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [captureElement]);

  const shareTicket = useCallback(async (data: TicketData) => {
    const lines = [
      "🎫 PLAYTURF BOOKING TICKET",
      "",
      `📍 ${data.turfName}`,
      `🏟️ ${data.sport || "Sport"}`,
      `📅 ${data.date}`,
      `⏰ ${data.startTime} – ${data.endTime}`,
      `⏳ ${data.duration} hour(s)`,
      `💰 ₹${data.amount.toLocaleString("en-IN")}`,
      `📊 Status: ${data.status}`,
      `🆔 Booking ID: ${data.bookingId}`,
      data.paymentId ? `💳 Transaction: ${data.paymentId}` : "",
      data.address ? `📌 ${data.address}` : "",
      data.hostName ? `👤 Host: ${data.hostName}` : "",
      data.playerName ? `👤 Player: ${data.playerName}` : "",
      "",
      "Thank you for choosing PlayTurf! 🏆",
      "Download your full PDF ticket from the app.",
    ].filter(Boolean);

    const text = lines.join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: "PlayTurf Booking Ticket",
          text,
        });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Ticket details copied to clipboard!");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        await navigator.clipboard.writeText(text);
        toast.success("Ticket details copied to clipboard!");
      }
    }
  }, []);

  return { ticketRef, downloadPDF, shareTicket, isGenerating };
}
