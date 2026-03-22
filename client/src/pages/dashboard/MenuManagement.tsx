import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, Pencil, Trash2, ChevronRight, Globe, Navigation, ExternalLink, Eye, EyeOff } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type MenuRow = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  location: string;
  isActive: boolean;
  isDefault: boolean;
};

type MenuItemRow = {
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
};

// ── Sortable Item ──────────────────────────────────────────────────────────

function SortableMenuItem({
  item,
  depth,
  onEdit,
  onDelete,
}: {
  item: MenuItemRow;
  depth: number;
  onEdit: (item: MenuItemRow) => void;
  onDelete: (item: MenuItemRow) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const visibilityBadge =
    item.visibility === "logged_in_only" ? { label: "Auth only", color: "bg-blue-100 text-blue-700" } :
    item.visibility === "logged_out_only" ? { label: "Guest only", color: "bg-yellow-100 text-yellow-700" } :
    null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2 text-sm group ${depth > 0 ? "ml-8" : ""}`}
      data-testid={`menu-item-${item.id}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
        data-testid={`drag-handle-${item.id}`}
      >
        <GripVertical size={16} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium truncate ${!item.isActive ? "line-through text-muted-foreground" : ""}`}>
            {item.label}
          </span>
          {item.openInNewTab && <ExternalLink size={12} className="text-muted-foreground shrink-0" />}
          {visibilityBadge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${visibilityBadge.color}`}>
              {visibilityBadge.label}
            </span>
          )}
        </div>
        {item.url && (
          <p className="text-xs text-muted-foreground truncate">{item.url}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(item)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          data-testid={`edit-item-${item.id}`}
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onDelete(item)}
          className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"
          data-testid={`delete-item-${item.id}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Item Form Dialog ───────────────────────────────────────────────────────

function ItemFormDialog({
  open,
  onClose,
  menuId,
  item,
  parentOptions,
}: {
  open: boolean;
  onClose: () => void;
  menuId: number;
  item: MenuItemRow | null;
  parentOptions: { id: number; label: string }[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [label, setLabel] = useState(item?.label ?? "");
  const [type, setType] = useState(item?.type ?? "internal");
  const [url, setUrl] = useState(item?.url ?? "");
  const [openInNewTab, setOpenInNewTab] = useState(item?.openInNewTab ?? false);
  const [visibility, setVisibility] = useState(item?.visibility ?? "always");
  const [parentId, setParentId] = useState<string>(item?.parentId?.toString() ?? "none");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);

  const isEditing = !!item;

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        return apiRequest("PATCH", `/api/admin/menus/${menuId}/items/${item!.id}`, data);
      } else {
        return apiRequest("POST", `/api/admin/menus/${menuId}/items`, data);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/menus", menuId] });
      toast({ title: isEditing ? "Item updated" : "Item added" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!label.trim()) {
      toast({ title: "Label is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      label: label.trim(),
      type,
      url: url.trim() || null,
      openInNewTab,
      visibility,
      parentId: parentId === "none" ? null : Number(parentId),
      isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="item-label">Label</Label>
            <Input
              id="item-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. About Us"
              data-testid="input-item-label"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="item-type" data-testid="select-item-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal Link</SelectItem>
                <SelectItem value="anchor">Anchor / Hash</SelectItem>
                <SelectItem value="cms_page">CMS Page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-url">URL</Label>
            <Input
              id="item-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={type === "anchor" ? "#section-id" : "/path/to/page"}
              data-testid="input-item-url"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-visibility">Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger id="item-visibility" data-testid="select-item-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Always visible</SelectItem>
                <SelectItem value="logged_in_only">Logged in only</SelectItem>
                <SelectItem value="logged_out_only">Logged out only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {parentOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="item-parent">Parent item (optional)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger id="item-parent" data-testid="select-item-parent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None (top level) —</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Switch checked={openInNewTab} onCheckedChange={setOpenInNewTab} id="item-new-tab" data-testid="switch-new-tab" />
            <Label htmlFor="item-new-tab">Open in new tab</Label>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="item-active" data-testid="switch-item-active" />
            <Label htmlFor="item-active">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-item">
            {saveMutation.isPending ? "Saving…" : isEditing ? "Save Changes" : "Add Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Menu Form Dialog ───────────────────────────────────────────────────────

function MenuFormDialog({
  open,
  onClose,
  menu,
}: {
  open: boolean;
  onClose: () => void;
  menu: MenuRow | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState(menu?.name ?? "");
  const [slug, setSlug] = useState(menu?.slug ?? "");
  const [description, setDescription] = useState(menu?.description ?? "");
  const [location, setLocation] = useState(menu?.location ?? "navbar");
  const [isActive, setIsActive] = useState(menu?.isActive ?? true);

  const isEditing = !!menu;

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        return apiRequest("PATCH", `/api/admin/menus/${menu!.id}`, data);
      } else {
        return apiRequest("POST", "/api/admin/menus", data);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/menus"] });
      toast({ title: isEditing ? "Menu updated" : "Menu created" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const autoSlug = (n: string) =>
    n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleNameChange = (v: string) => {
    setName(v);
    if (!isEditing) setSlug(autoSlug(v));
  };

  const handleSave = () => {
    if (!name.trim() || !slug.trim()) {
      toast({ title: "Name and slug are required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ name: name.trim(), slug: slug.trim(), description: description.trim(), location, isActive });
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Menu" : "Create Menu"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="menu-name">Name</Label>
            <Input id="menu-name" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Main Navigation" data-testid="input-menu-name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="menu-slug">Slug (used in code)</Label>
            <Input id="menu-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. main-nav" data-testid="input-menu-slug" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="menu-description">Description</Label>
            <Input id="menu-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" data-testid="input-menu-description" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="menu-location">Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger id="menu-location" data-testid="select-menu-location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="navbar">Navbar</SelectItem>
                <SelectItem value="footer">Footer</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="sidebar-custom">Sidebar (Custom)</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="menu-active" data-testid="switch-menu-active" />
            <Label htmlFor="menu-active">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-menu">
            {saveMutation.isPending ? "Saving…" : isEditing ? "Save Changes" : "Create Menu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function MenuManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuRow | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemRow | null>(null);
  const [deletingMenu, setDeletingMenu] = useState<MenuRow | null>(null);
  const [deletingItem, setDeletingItem] = useState<MenuItemRow | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch all menus
  const { data: menus = [], isLoading: menusLoading } = useQuery<MenuRow[]>({
    queryKey: ["/api/admin/menus"],
  });

  // Fetch selected menu's details (with items)
  const { data: menuDetail, isLoading: detailLoading } = useQuery<MenuRow & { items: MenuItemRow[] }>({
    queryKey: ["/api/admin/menus", selectedMenuId],
    enabled: !!selectedMenuId,
  });

  const [localItems, setLocalItems] = useState<MenuItemRow[]>([]);

  // Sync local items when menuDetail changes
  if (menuDetail?.items && JSON.stringify(menuDetail.items.map(i => i.id)) !== JSON.stringify(localItems.map(i => i.id))) {
    setLocalItems(menuDetail.items);
  }

  // Flattened list: top-level first, then each parent's children
  const flatItems: MenuItemRow[] = [];
  const topLevel = localItems.filter(i => !i.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  topLevel.forEach(parent => {
    flatItems.push(parent);
    const children = localItems.filter(i => i.parentId === parent.id).sort((a, b) => a.sortOrder - b.sortOrder);
    children.forEach(child => flatItems.push(child));
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: number; sortOrder: number; parentId: number | null }[]) =>
      apiRequest("PUT", `/api/admin/menus/${selectedMenuId}/items/reorder`, { items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/menus", selectedMenuId] }),
    onError: () => toast({ title: "Failed to save order", variant: "destructive" }),
  });

  const deleteMenuMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/menus/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/menus"] });
      if (selectedMenuId === deletingMenu?.id) setSelectedMenuId(null);
      toast({ title: "Menu deleted" });
      setDeletingMenu(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setDeletingMenu(null);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (item: MenuItemRow) =>
      apiRequest("DELETE", `/api/admin/menus/${item.menuId}/items/${item.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/menus", selectedMenuId] });
      toast({ title: "Item deleted" });
      setDeletingItem(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setDeletingItem(null);
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = flatItems.findIndex(i => i.id === active.id);
    const newIndex = flatItems.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(flatItems, oldIndex, newIndex);
    setLocalItems(reordered);

    const updates = reordered.map((item, idx) => ({
      id: item.id,
      sortOrder: idx,
      parentId: item.parentId,
    }));
    reorderMutation.mutate(updates);
  }

  const selectedMenu = menus.find(m => m.id === selectedMenuId);
  const topLevelItems = localItems.filter(i => !i.parentId);

  return (
    <div data-testid="page-menu-management">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display" data-testid="heading-menus">Menus</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage navigation menus for the site</p>
        </div>
        <Button onClick={() => { setEditingMenu(null); setShowMenuForm(true); }} data-testid="button-create-menu">
          <Plus size={16} className="mr-1.5" /> New Menu
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Menu List */}
        <div className="md:col-span-1 space-y-2" data-testid="menu-list">
          {menusLoading ? (
            <div className="text-muted-foreground text-sm py-8 text-center">Loading…</div>
          ) : menus.length === 0 ? (
            <div className="text-muted-foreground text-sm py-8 text-center border border-dashed rounded-lg">
              No menus yet. Create one to get started.
            </div>
          ) : (
            menus.map((menu) => (
              <button
                key={menu.id}
                onClick={() => setSelectedMenuId(menu.id)}
                className={`w-full text-left flex items-center justify-between px-3 py-3 rounded-lg border text-sm transition-colors ${
                  selectedMenuId === menu.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white border-border hover:bg-muted"
                }`}
                data-testid={`menu-row-${menu.id}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Navigation size={14} className="shrink-0" />
                    <span className="font-medium truncate">{menu.name}</span>
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${selectedMenuId === menu.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {menu.slug}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {!menu.isActive && <EyeOff size={13} className="opacity-60" />}
                  {menu.isDefault && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${selectedMenuId === menu.id ? "bg-white/20" : "bg-muted"}`}>
                      default
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Menu Detail / Item Builder */}
        <div className="md:col-span-2">
          {!selectedMenuId ? (
            <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-xl text-muted-foreground text-sm">
              <Navigation size={32} className="mb-3 opacity-40" />
              <p>Select a menu to edit its items</p>
            </div>
          ) : detailLoading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading…</div>
          ) : menuDetail ? (
            <div>
              {/* Menu header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold font-display text-lg">{menuDetail.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    <code className="bg-muted px-1 rounded">{menuDetail.slug}</code>
                    {" · "}
                    {menuDetail.location}
                    {menuDetail.description && ` · ${menuDetail.description}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingMenu(menuDetail); setShowMenuForm(true); }}
                    data-testid="button-edit-menu"
                  >
                    <Pencil size={14} className="mr-1" /> Edit
                  </Button>
                  {!menuDetail.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingMenu(menuDetail)}
                      className="text-red-500 border-red-200 hover:bg-red-50"
                      data-testid="button-delete-menu"
                    >
                      <Trash2 size={14} className="mr-1" /> Delete
                    </Button>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2 mb-4" data-testid="menu-items-list">
                {flatItems.length === 0 ? (
                  <div className="text-muted-foreground text-sm py-8 text-center border border-dashed rounded-lg">
                    No items yet. Add the first item below.
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={flatItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                      {flatItems.map((item) => (
                        <SortableMenuItem
                          key={item.id}
                          item={item}
                          depth={item.parentId ? 1 : 0}
                          onEdit={(i) => { setEditingItem(i); setShowItemForm(true); }}
                          onDelete={(i) => setDeletingItem(i)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => { setEditingItem(null); setShowItemForm(true); }}
                data-testid="button-add-item"
              >
                <Plus size={14} className="mr-1" /> Add Item
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Menu Form Dialog */}
      {showMenuForm && (
        <MenuFormDialog
          open={showMenuForm}
          onClose={() => { setShowMenuForm(false); setEditingMenu(null); }}
          menu={editingMenu}
        />
      )}

      {/* Item Form Dialog */}
      {showItemForm && selectedMenuId && (
        <ItemFormDialog
          open={showItemForm}
          onClose={() => { setShowItemForm(false); setEditingItem(null); }}
          menuId={selectedMenuId}
          item={editingItem}
          parentOptions={topLevelItems.map(i => ({ id: i.id, label: i.label }))}
        />
      )}

      {/* Delete Menu Confirm */}
      <AlertDialog open={!!deletingMenu} onOpenChange={() => setDeletingMenu(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingMenu?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the menu and all its items. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingMenu && deleteMenuMutation.mutate(deletingMenu.id)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-menu"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Item Confirm */}
      <AlertDialog open={!!deletingItem} onOpenChange={() => setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingItem?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This item will be permanently removed from the menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingItem && deleteItemMutation.mutate(deletingItem)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-item"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
