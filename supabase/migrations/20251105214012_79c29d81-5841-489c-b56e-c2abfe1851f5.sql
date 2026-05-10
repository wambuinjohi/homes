-- Add landlord_images field to maintenance_requests table
ALTER TABLE public.maintenance_requests 
ADD COLUMN IF NOT EXISTS landlord_images TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.maintenance_requests.landlord_images IS 'Photos uploaded by landlord showing completed repair work';

-- Update RLS policy to allow landlords to upload images for their properties
CREATE POLICY "Landlords can upload to maintenance-images for their properties"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'maintenance-images' 
  AND (storage.foldername(name))[1] IN (
    SELECT mr.id::text
    FROM public.maintenance_requests mr
    JOIN public.properties p ON mr.property_id = p.id
    WHERE p.owner_id = auth.uid() OR p.manager_id = auth.uid()
  )
);

-- Allow landlords to view maintenance images for their properties
CREATE POLICY "Landlords can view maintenance-images for their properties"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'maintenance-images'
  AND (storage.foldername(name))[1] IN (
    SELECT mr.id::text
    FROM public.maintenance_requests mr
    JOIN public.properties p ON mr.property_id = p.id
    WHERE p.owner_id = auth.uid() OR p.manager_id = auth.uid()
  )
);