import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

interface UseUrlPageParamOptions {
  pageSize?: number;
  defaultPage?: number;
}

export const useUrlPageParam = (options: UseUrlPageParamOptions = {}) => {
  const { pageSize = 10, defaultPage = 1 } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  
  const currentPage = parseInt(searchParams.get("page") || defaultPage.toString());
  const currentPageSize = parseInt(searchParams.get("pageSize") || pageSize.toString());

  const setPage = (page: number) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (page === defaultPage) {
      newSearchParams.delete("page");
    } else {
      newSearchParams.set("page", page.toString());
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  const setPageSize = (size: number) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (size === pageSize) {
      newSearchParams.delete("pageSize");
    } else {
      newSearchParams.set("pageSize", size.toString());
    }
    // Reset to first page when changing page size
    newSearchParams.delete("page");
    setSearchParams(newSearchParams, { replace: true });
  };

  const offset = (currentPage - 1) * currentPageSize;

  return {
    page: currentPage,
    pageSize: currentPageSize,
    offset,
    setPage,
    setPageSize
  };
};