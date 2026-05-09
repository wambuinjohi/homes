UPDATE pdf_templates 
SET content = '{
  "layout": {
    "type": "professional",
    "orientation": "portrait",
    "margins": {
      "top": 30,
      "right": 20,
      "bottom": 30,
      "left": 20
    },
    "spacing": {
      "sectionGap": 15,
      "cardGap": 8,
      "textLineHeight": 1.4
    }
  },
  "header": {
    "type": "branded",
    "height": 35,
    "showLogo": true,
    "showCompanyInfo": true,
    "style": {
      "backgroundColor": "#1B365D",
      "textColor": "#FFFFFF",
      "accentColor": "#F36F21",
      "logoMaxHeight": 15,
      "companyNameSize": 18,
      "taglineSize": 10
    }
  },
  "typography": {
    "fontFamily": "Helvetica",
    "baseFontSize": 11,
    "titleFontSize": 24,
    "headingFontSize": 14,
    "subtitleFontSize": 12,
    "hierarchy": {
      "h1": {"size": 16, "weight": "bold", "color": "#1B365D"},
      "h2": {"size": 14, "weight": "bold", "color": "#1B365D"},
      "h3": {"size": 12, "weight": "bold", "color": "#374151"},
      "body": {"size": 11, "weight": "normal", "color": "#374151"},
      "caption": {"size": 9, "weight": "normal", "color": "#64748B"}
    }
  },
  "colors": {
    "primary": "#1B365D",
    "secondary": "#64748B", 
    "accent": "#F36F21",
    "neutral": "#F8F9FB",
    "border": "#E2E8F0",
    "text": "#374151",
    "textMuted": "#64748B",
    "success": "#10B981",
    "warning": "#F59E0B",
    "error": "#EF4444"
  },
  "sections": {
    "title": {
      "style": {
        "fontSize": 24,
        "fontWeight": "bold",
        "color": "#1B365D",
        "marginBottom": 20,
        "underlineColor": "#F36F21",
        "underlineWidth": 2
      }
    },
    "kpi": {
      "layout": "grid",
      "columns": 4,
      "maxPerRow": 4,
      "cardStyle": {
        "backgroundColor": "#FFFFFF",
        "borderColor": "#E2E8F0",
        "borderWidth": 1,
        "borderRadius": 8,
        "padding": 16,
        "shadow": "0 2px 4px rgba(0,0,0,0.1)",
        "height": 28,
        "spacing": 8
      },
      "typography": {
        "valueSize": 16,
        "valueFontWeight": "bold",
        "valueColor": "#1B365D",
        "labelSize": 9,
        "labelColor": "#64748B",
        "labelWeight": "normal"
      }
    },
    "content": {
      "style": {
        "fontSize": 11,
        "lineHeight": 1.4,
        "color": "#374151"
      }
    },
    "tables": {
      "headerStyle": {
        "backgroundColor": "#1B365D",
        "textColor": "#FFFFFF",
        "fontWeight": "bold",
        "fontSize": 10,
        "padding": 8
      },
      "rowStyle": {
        "fontSize": 9,
        "padding": 6,
        "borderColor": "#E2E8F0"
      },
      "alternateRowColor": "#F8F9FB",
      "borderColor": "#E2E8F0"
    },
    "charts": {
      "titleSize": 12,
      "titleColor": "#1B365D",
      "backgroundColor": "#FFFFFF",
      "borderColor": "#E2E8F0",
      "gridColor": "#F1F5F9"
    }
  },
  "footer": {
    "type": "branded",
    "height": 20,
    "showCompanyInfo": true,
    "showPageNumbers": true,
    "showGenerationDate": true,
    "style": {
      "backgroundColor": "#F8F9FB",
      "textColor": "#64748B",
      "borderColor": "#E2E8F0",
      "fontSize": 8,
      "companyInfoFormat": "{companyName} • {phone} • {email}",
      "dateFormat": "MMM dd, yyyy"
    }
  },
  "branding": {
    "showWatermark": false,
    "professionalMode": true,
    "compactMode": false,
    "colorTheme": "corporate"
  }
}'::jsonb
WHERE name = 'Zira Professional Template'