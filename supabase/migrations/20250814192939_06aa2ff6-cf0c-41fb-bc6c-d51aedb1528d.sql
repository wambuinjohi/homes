-- Create the master PDF template with Zira Homes professional layout
INSERT INTO public.pdf_templates (
    id,
    name,
    type,
    description,
    content,
    version,
    is_active,
    created_by
) VALUES (
    gen_random_uuid(),
    'Zira Professional Template',
    'universal',
    'Professional PDF template for all Zira documents with consistent branding and layout',
    '{
        "layout": {
            "type": "professional",
            "orientation": "portrait",
            "margins": {
                "top": 30,
                "bottom": 30,
                "left": 20,
                "right": 20
            }
        },
        "header": {
            "type": "branded",
            "showLogo": true,
            "showCompanyInfo": true,
            "style": {
                "backgroundColor": "#1B365D",
                "textColor": "#FFFFFF",
                "accentColor": "#F36F21"
            }
        },
        "sections": {
            "title": {
                "style": {
                    "fontSize": 24,
                    "fontWeight": "bold",
                    "color": "#1B365D",
                    "marginBottom": 20
                }
            },
            "kpi": {
                "layout": "grid",
                "columns": 4,
                "cardStyle": {
                    "backgroundColor": "#F8F9FB",
                    "borderColor": "#E2E8F0",
                    "borderWidth": 1,
                    "borderRadius": 8,
                    "padding": 15
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
                    "fontWeight": "bold"
                },
                "alternateRowColor": "#F8F9FB",
                "borderColor": "#E2E8F0"
            }
        },
        "footer": {
            "type": "branded",
            "showCompanyInfo": true,
            "showPageNumbers": true,
            "style": {
                "backgroundColor": "#F8F9FB",
                "textColor": "#64748B",
                "borderColor": "#E2E8F0"
            }
        },
        "colors": {
            "primary": "#1B365D",
            "secondary": "#64748B",
            "accent": "#F36F21",
            "neutral": "#F8F9FB",
            "border": "#E2E8F0",
            "text": "#374151"
        },
        "typography": {
            "fontFamily": "Helvetica",
            "baseFontSize": 11,
            "headingFontSize": 14,
            "titleFontSize": 24
        }
    }'::jsonb,
    1,
    true,
    null
);

-- Get the template ID for creating bindings
WITH template_data AS (
    SELECT id as template_id FROM public.pdf_templates 
    WHERE name = 'Zira Professional Template' AND is_active = true 
    LIMIT 1
),
document_types AS (
    SELECT unnest(ARRAY['invoice', 'report', 'letter', 'notice', 'lease', 'receipt']) as doc_type
),
user_roles AS (
    SELECT unnest(ARRAY['Admin', 'Landlord', 'Manager', 'Agent', 'Tenant']) as role,
           unnest(ARRAY[100, 90, 80, 70, 60]) as priority
)
INSERT INTO public.pdf_template_bindings (
    template_id,
    document_type,
    role,
    landlord_id,
    priority,
    is_active
)
SELECT 
    t.template_id,
    d.doc_type,
    r.role,
    null, -- Global template (not landlord-specific)
    r.priority,
    true
FROM template_data t
CROSS JOIN document_types d
CROSS JOIN user_roles r;