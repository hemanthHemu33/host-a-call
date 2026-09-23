import { useEffect } from 'react';

export const useRouteAnalytics = (pathname: string) => {
  useEffect(() => {
    void pathname;
  }, [pathname]);
};
