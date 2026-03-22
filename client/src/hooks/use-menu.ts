import { useQuery } from "@tanstack/react-query";

export type MenuItemNode = {
  id: number;
  menuId: number;
  parentId: number | null;
  label: string;
  type: string;
  url: string | null;
  openInNewTab: boolean;
  visibility: string;
  sortOrder: number;
  isActive: boolean;
  children: MenuItemNode[];
};

export type MenuData = {
  id: number;
  slug: string;
  name: string;
  location: string;
  isActive: boolean;
  isDefault: boolean;
  items: MenuItemNode[];
};

export function useMenu(slug: string) {
  return useQuery<MenuData>({
    queryKey: ["/api/menus", slug],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
