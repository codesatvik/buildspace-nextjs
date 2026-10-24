"use client"

import { useUser } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) { 
    const { user } = useUser();
    const [ queryClient ] = useState(
        () => 
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,
                        refetchOnMount: true,
                        refetchOnWindowFocus: true,
                    },
                }
            })
    )

    useEffect(() => {
        if (user) {
            queryClient.invalidateQueries();
            queryClient.clear()
        }
    }, [user?.id, queryClient]);

    return (
        <QueryClientProvider client={queryClient}> {children} </QueryClientProvider>
    )
}