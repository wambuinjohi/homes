import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface UseLoadingButtonOptions {
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
}

export const useLoadingButton = (options: UseLoadingButtonOptions = {}) => {
  const [isLoading, setIsLoading] = useState(false);

  const execute = async (asyncFn: () => Promise<any>) => {
    try {
      setIsLoading(true);
      const result = await asyncFn();
      
      if (options.successMessage) {
        toast({
          title: "Success",
          description: options.successMessage,
        });
      }
      
      options.onSuccess?.(result);
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('An unexpected error occurred');
      
      toast({
        title: "Error",
        description: options.errorMessage || errorObj.message,
        variant: "destructive",
      });
      
      options.onError?.(errorObj);
      throw errorObj;
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, execute };
};