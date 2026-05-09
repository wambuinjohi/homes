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
    'report',
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

-- Create additional templates for each document type
INSERT INTO public.pdf_templates (name, type, description, content, version, is_active)
VALUES 
('Zira Invoice Template', 'invoice', 'Professional invoice template', '{
    "extends": "zira-professional",
    "documentSpecific": {
        "showPaymentTerms": true,
        "showDueDate": true,
        "includeItemizedList": true
    }
}'::jsonb, 1, true),
('Zira Letter Template', 'letter', 'Professional letter template', '{
    "extends": "zira-professional",
    "documentSpecific": {
        "showLetterhead": true,
        "includeSignature": true
    }
}'::jsonb, 1, true),
('Zira Notice Template', 'notice', 'Professional notice template', '{
    "extends": "zira-professional",
    "documentSpecific": {
        "emphasizeUrgency": true,
        "includeActionRequired": true
    }
}'::jsonb, 1, true),
('Zira Lease Template', 'lease', 'Professional lease template', '{
    "extends": "zira-professional",
    "documentSpecific": {
        "showTermsAndConditions": true,
        "includeSignatureBlocks": true
    }
}'::jsonb, 1, true),
('Zira Receipt Template', 'receipt', 'Professional receipt template', '{
    "extends": "zira-professional",
    "documentSpecific": {
        "showPaymentMethod": true,
        "includeTransactionId": true
    }
}'::jsonb, 1, true);

-- Get template IDs and create bindings for all document types and roles
WITH template_data AS (
    SELECT id as template_id, type as doc_type 
    FROM public.pdf_templates 
    WHERE name LIKE 'Zira%Template' AND is_active = true
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
    t.doc_type,
    r.role,
    null, -- Global template (not landlord-specific)
    r.priority,
    true
FROM template_data t
CROSS JOIN user_roles r;