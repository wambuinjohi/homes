-- Create storage bucket for maintenance request images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maintenance-images',
  'maintenance-images',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
);

-- RLS Policy: Allow tenants to upload images to their own maintenance requests
CREATE POLICY "Tenants can upload maintenance images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'maintenance-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Allow authenticated users to view maintenance images they have access to
CREATE POLICY "Users can view maintenance images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'maintenance-images'
  AND (
    -- Allow tenant to view their own images
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Allow property owners to view images for their properties
    EXISTS (
      SELECT 1 FROM maintenance_requests mr
      JOIN properties p ON p.id = mr.property_id
      WHERE mr.tenant_id::text = (storage.foldername(name))[1]
      AND p.owner_id = auth.uid()
    )
  )
);

-- RLS Policy: Allow users to delete their own maintenance images
CREATE POLICY "Users can delete their maintenance images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'maintenance-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);