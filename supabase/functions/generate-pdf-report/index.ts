import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reportId, filters } = await req.json()
    
    if (!reportId) {
      return new Response(
        JSON.stringify({ error: 'Report ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // For now, generate a simple PDF using basic approach
    // In production, you'd use puppeteer or similar
    const pdfContent = generateSimplePDF(reportId, filters)
    
    // Convert string to Uint8Array for PDF
    const encoder = new TextEncoder()
    const pdfBytes = encoder.encode(pdfContent)
    
    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${reportId}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate PDF' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function generateSimplePDF(reportId: string, filters: any): string {
  // This creates a minimal PDF structure
  // For demonstration - in production use proper PDF library
  return `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj

4 0 obj
<<
/Length 200
>>
stream
BT
/F1 24 Tf
50 700 Td
(Report: ${reportId}) Tj
0 -50 Td
/F1 12 Tf
(Period: ${filters?.periodPreset || 'current_period'}) Tj
0 -20 Td
(Generated: ${new Date().toISOString()}) Tj
0 -40 Td
(This is a sample PDF report.) Tj
0 -20 Td
(In production, this would contain) Tj
0 -20 Td
(actual report data and charts.) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000079 00000 n 
0000000136 00000 n 
0000000364 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
615
%%EOF`
}