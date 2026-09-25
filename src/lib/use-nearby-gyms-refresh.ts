import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { refreshNearbyGyms } from "@/lib/server/queries";

/**
 * After the user picks a place, import OpenStreetMap gyms around it in the
 * background. Gym lists render immediately from the database and refetch
 * once new gyms land, instead of blocking on OpenStreetMap for 15–25 s.
 */
export function useNearbyGymsRefresh(origin: { lat: number; lng: number; hasPlace: boolean; hydrated: boolean }, miles = 25) {
  const qc = useQueryClient();
  const radius = Math.min(Math.max(miles || 25, 5), 50);
  const refresh = useQuery({
    queryKey: ["nearby-refresh", origin.lat.toFixed(2), origin.lng.toFixed(2), radius],
    queryFn: () => refreshNearbyGyms({ data: { lat: origin.lat, lng: origin.lng, miles: radius } }),
    enabled: origin.hydrated && origin.hasPlace,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 0,
  });
  const added = refresh.data?.added ?? 0;
  useEffect(() => {
    if (added > 0) {
      void qc.invalidateQueries({ queryKey: ["gyms-map"] });
      void qc.invalidateQueries({ queryKey: ["gyms-browse"] });
    }
  }, [added, qc]);
  return { importing: refresh.isFetching };
}
