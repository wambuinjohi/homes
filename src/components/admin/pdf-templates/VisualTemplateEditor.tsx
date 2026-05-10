import React, { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricText, Rect, FabricImage } from "fabric";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Upload, 
  Type, 
  Palette, 
  Save, 
  Undo, 
  Redo, 
  Download,
  Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";

interface VisualTemplateEditorProps {
  template: {
    id: string;
    name: string;
    type: 'financial' | 'report' | 'legal' | 'communication';
    branding?: {
      companyName: string;
      companyTagline: string;
      companyAddress: string;
      companyPhone: string;
      companyEmail: string;
      logoUrl?: string;
      primaryColor: string;
      secondaryColor: string;
      footerText: string;
    };
  };
  onSave: (templateData: any) => void;
  onClose: () => void;
}

export const VisualTemplateEditor: React.FC<VisualTemplateEditorProps> = ({
  template,
  onSave,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [selectedColor, setSelectedColor] = useState(template.branding?.primaryColor || "#2563eb");
  const [selectedTool, setSelectedTool] = useState<"select" | "text" | "logo">("select");
  
  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    console.log("Initializing Fabric.js canvas...");
    
    const canvas = new FabricCanvas(canvasRef.current, {
      width: 800,
      height: 1000,
      backgroundColor: "#ffffff",
    });

    console.log("Canvas created:", canvas);

    // Enable object selection and interaction
    canvas.selection = true;
    canvas.selectionColor = 'rgba(100, 100, 255, 0.3)';
    canvas.selectionLineWidth = 2;

    setFabricCanvas(canvas);
    
    // Load initial template content
    loadTemplateContent(canvas);

    // Add event listeners for debugging
    canvas.on('selection:created', (e) => {
      console.log('Object selected:', e.selected);
    });

    canvas.on('object:moving', (e) => {
      console.log('Object moving:', e.target);
    });

    return () => {
      console.log("Disposing canvas...");
      canvas.dispose();
    };
  }, [template]);

  const loadTemplateContent = (canvas: FabricCanvas) => {
    // Clear canvas
    canvas.clear();
    canvas.backgroundColor = "#ffffff";

    console.log("Loading template content...");

    const branding = template.branding || {
      companyName: "Company Name",
      companyTagline: "Your tagline here",
      primaryColor: "#2563eb"
    };

    // Create header background
    const headerBg = new Rect({
      left: 0,
      top: 0,
      width: 800,
      height: 100,
      fill: branding.primaryColor,
      selectable: true,
      evented: true,
      moveCursor: 'move',
      hoverCursor: 'move',
    });
    canvas.add(headerBg);
    console.log("Added header background");

    // Add company name text
    const companyNameText = new FabricText(branding.companyName, {
      left: 20,
      top: 25,
      fontSize: 28,
      fontWeight: 'bold',
      fill: '#ffffff',
      fontFamily: 'Arial',
      selectable: true,
      evented: true,
      moveCursor: 'move',
      hoverCursor: 'move',
    });
    canvas.add(companyNameText);
    console.log("Added company name text");

    // Add company tagline
    const taglineText = new FabricText(branding.companyTagline, {
      left: 20,
      top: 55,
      fontSize: 14,
      fill: '#ffffff',
      fontFamily: 'Arial',
      selectable: true,
      evented: true,
      moveCursor: 'move',
      hoverCursor: 'move',
    });
    canvas.add(taglineText);
    console.log("Added tagline text");

    // Add invoice title (for financial templates)
    if (template.type === 'financial') {
      const invoiceTitle = new FabricText('INVOICE', {
        left: 600,
        top: 25,
        fontSize: 24,
        fontWeight: 'bold',
        fill: '#ffffff',
        fontFamily: 'Arial',
        selectable: true,
        evented: true,
        moveCursor: 'move',
        hoverCursor: 'move',
      });
      canvas.add(invoiceTitle);

      // Add invoice number
      const invoiceNumber = new FabricText('INV-2024-00123', {
        left: 600,
        top: 55,
        fontSize: 14,
        fill: '#ffffff',
        fontFamily: 'Arial',
        selectable: true,
        evented: true,
        moveCursor: 'move',
        hoverCursor: 'move',
      });
      canvas.add(invoiceNumber);

      // Add bill to section
      const billToTitle = new FabricText('Bill To:', {
        left: 20,
        top: 150,
        fontSize: 16,
        fontWeight: 'bold',
        fill: '#000000',
        fontFamily: 'Arial',
        selectable: true,
        evented: true,
        moveCursor: 'move',
        hoverCursor: 'move',
      });
      canvas.add(billToTitle);

      // Add sample table headers
      const tableHeaderBg = new Rect({
        left: 20,
        top: 400,
        width: 760,
        height: 40,
        fill: '#f3f4f6',
        stroke: '#e5e7eb',
        strokeWidth: 1,
        selectable: true,
        evented: true,
        moveCursor: 'move',
        hoverCursor: 'move',
      });
      canvas.add(tableHeaderBg);

      const descriptionHeader = new FabricText('Description', {
        left: 30,
        top: 410,
        fontSize: 14,
        fontWeight: 'bold',
        fill: '#000000',
        fontFamily: 'Arial',
        selectable: true,
        evented: true,
        moveCursor: 'move',
        hoverCursor: 'move',
      });
      canvas.add(descriptionHeader);

      const amountHeader = new FabricText('Amount', {
        left: 680,
        top: 410,
        fontSize: 14,
        fontWeight: 'bold',
        fill: '#000000',
        fontFamily: 'Arial',
        selectable: true,
        evented: true,
        moveCursor: 'move',
        hoverCursor: 'move',
      });
      canvas.add(amountHeader);

      // Add footer
      const footerBg = new Rect({
        left: 0,
        top: 900,
        width: 800,
        height: 100,
        fill: branding.primaryColor,
        selectable: true,
        evented: true,
        moveCursor: 'move',
        hoverCursor: 'move',
      });
      canvas.add(footerBg);

      const footerText = new FabricText((branding as any).footerText || 'Thank you for your business!', {
        left: 20,
        top: 920,
        fontSize: 14,
        fill: '#ffffff',
        fontFamily: 'Arial',
        selectable: true,
        evented: true,
        moveCursor: 'move',
        hoverCursor: 'move',
      });
      canvas.add(footerText);
    }

    canvas.renderAll();
    console.log("Template loaded, canvas rendered");
    toast("Template loaded! Click on any element to edit it.");
  };

  const handleAddText = () => {
    if (!fabricCanvas) return;

    console.log("Adding new text element...");

    const text = new FabricText('Click to edit text', {
      left: 100,
      top: 200,
      fontSize: 16,
      fill: selectedColor,
      fontFamily: 'Arial',
      selectable: true,
      evented: true,
      moveCursor: 'move',
      hoverCursor: 'move',
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
    
    console.log("Text added to canvas:", text);
    toast("Text added! Double-click to edit content.");
  };

  const handleLogoUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !fabricCanvas) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imgUrl = e.target?.result as string;
      
      FabricImage.fromURL(imgUrl).then((img) => {
        // Scale image to reasonable size
        img.scale(0.2);
        img.set({
          left: 650,
          top: 20,
          selectable: true,
          evented: true,
          moveCursor: 'move',
          hoverCursor: 'move',
        });
        
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
        fabricCanvas.renderAll();
        console.log("Logo uploaded and added to canvas:", img);
        toast("Logo uploaded! Drag to reposition or resize using handles.");
      });
    };
    reader.readAsDataURL(file);
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    
    const activeObject = fabricCanvas?.getActiveObject();
    if (activeObject) {
      if (activeObject instanceof FabricText) {
        activeObject.set('fill', color);
      } else if (activeObject instanceof Rect) {
        activeObject.set('fill', color);
      }
      fabricCanvas?.renderAll();
    }
  };

  const handleSave = () => {
    if (!fabricCanvas) return;

    // Get canvas data
    const canvasData = fabricCanvas.toJSON();
    
    // Extract text content and colors for branding
    const objects = fabricCanvas.getObjects();
    const extractedBranding = {
      companyName: "Updated Company Name", // Would extract from actual text objects
      primaryColor: selectedColor,
      // ... other branding data
    };

    onSave({
      ...template,
      branding: extractedBranding,
      canvasData: canvasData
    });
    
    toast("Template saved successfully!");
  };

  const handleUndo = () => {
    // Implement undo functionality
    toast("Undo functionality would be implemented here");
  };

  const handleRedo = () => {
    // Implement redo functionality  
    toast("Redo functionality would be implemented here");
  };

  const handleDownload = () => {
    if (!fabricCanvas) return;
    
    const dataURL = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2
    });
    
    const link = document.createElement('a');
    link.download = `${template.name}.png`;
    link.href = dataURL;
    link.click();
    
    toast("Template downloaded as PNG!");
  };

  return (
    <div className="flex h-full">
      {/* Toolbar */}
      <Card className="w-80 mr-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Design Tools
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tools */}
          <div>
            <Label className="text-sm font-medium">Tools</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button
                variant={selectedTool === "select" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTool("select")}
              >
                Select
              </Button>
              <Button
                variant={selectedTool === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedTool("text");
                  handleAddText();
                }}
              >
                <Type className="h-4 w-4 mr-1" />
                Text
              </Button>
            </div>
          </div>

          <Separator />

          {/* Logo Upload */}
          <div>
            <Label className="text-sm font-medium">Logo</Label>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={handleLogoUpload}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Upload Logo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <Separator />

          {/* Color Picker */}
          <div>
            <Label className="text-sm font-medium">Colors</Label>
            <div className="mt-2">
              <Input
                type="color"
                value={selectedColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="h-10 cursor-pointer"
              />
              <div className="grid grid-cols-4 gap-2 mt-2">
                {["#2563eb", "#dc2626", "#059669", "#7c3aed", "#ea580c", "#0891b2"].map((color) => (
                  <button
                    key={color}
                    className="h-8 w-8 rounded border-2 border-gray-200"
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                  />
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={handleUndo}>
                <Undo className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleRedo}>
                <Redo className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button 
              className="w-full"
              onClick={handleSave}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Canvas Area */}
      <div className="flex-1">
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Visual Template Editor - {template.name}</CardTitle>
              <Button variant="outline" onClick={onClose}>
                Close Editor
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="border rounded-lg overflow-auto bg-gray-50 p-4">
              <canvas 
                ref={canvasRef} 
                className="border bg-white shadow-lg mx-auto block"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
