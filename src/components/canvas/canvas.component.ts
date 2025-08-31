import { html } from "lit-html";
import { BehaviorSubject, Subject, ignoreElements, map, mergeWith, tap } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import "./canvas.component.css";
import { getCaption } from "./get-caption";

export interface ImageItem {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  caption: string;
  isSelected?: boolean;
}

export const CanvasComponent = createComponent(
  (props: { images$: BehaviorSubject<ImageItem[]>; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    // Internal state
    // Local z-index sequence for ephemeral drag stacking without re-render
    let zSeq = 0;

    // Actions
    const pasteImage$ = new Subject<string>();
    const moveImage$ = new Subject<{ moves: { id: string; x: number; y: number }[] }>();
    const deleteSelected$ = new Subject<void>();

    // Effects
    const pasteEffect$ = pasteImage$.pipe(
      tap((src) => {
        const newImage: ImageItem = {
          id: `img-${Date.now()}`,
          src,
          x: Math.random() * 400, // Random position
          y: Math.random() * 400,
          caption: "",
          width: 200,
          height: 200,
        };
        props.images$.next([...props.images$.value, newImage]);

        // Generate caption using OpenAI
        const apiKey = props.apiKeys$.value.openai;
        if (apiKey) {
          (async () => {
            const caption = await getCaption(src, apiKey);
            if (caption) {
              const current = props.images$.value;
              const updated = current.map((img) => (img.id === newImage.id ? { ...img, caption } : img));
              props.images$.next(updated);
            }
          })();
        }
      }),
    );

    const moveEffect$ = moveImage$.pipe(
      tap(({ moves }) => {
        const current = props.images$.value;
        const movedItems = moves
          .map((move) => {
            const item = current.find((img) => img.id === move.id);
            return item ? { ...item, x: move.x, y: move.y } : null;
          })
          .filter(Boolean) as ImageItem[];
        const movedIds = moves.map((m) => m.id);
        const others = current.filter((img) => !movedIds.includes(img.id));
        props.images$.next([...others, ...movedItems]);
      }),
    );

    const deleteEffect$ = deleteSelected$.pipe(
      tap(() => {
        const current = props.images$.value;
        const updated = current.filter((img) => !img.isSelected);
        props.images$.next(updated);
      }),
    );

    const handleMouseDown = (image: ImageItem, e: MouseEvent) => {
      e.stopPropagation(); // Prevent canvas click when clicking on image

      const isCtrlPressed = e.ctrlKey || e.metaKey;
      const isShiftPressed = e.shiftKey;
      const currentImages = props.images$.value;

      // Handle selection logic
      let updatedImages: ImageItem[];
      const isAlreadySelected = image.isSelected;

      if (isCtrlPressed || isShiftPressed) {
        // Toggle selection for multi-select
        updatedImages = currentImages.map((img) =>
          img.id === image.id ? { ...img, isSelected: !img.isSelected } : img,
        );
      } else if (!isAlreadySelected) {
        // Single select - deselect all others, select this one (only if not already selected)
        updatedImages = currentImages.map((img) => ({
          ...img,
          isSelected: img.id === image.id,
        }));
      } else {
        // If already selected and no modifier, keep current selection
        updatedImages = currentImages;
      }
      props.images$.next(updatedImages);

      // Check if the clicked image is selected after update
      const updatedImage = updatedImages.find((img) => img.id === image.id);
      if (!updatedImage?.isSelected) return;

      // Get all selected items to drag
      const draggedItems = updatedImages.filter((img) => img.isSelected);

      const canvas = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
      const draggedData = draggedItems.map((item) => {
        const el = canvas.querySelector(`.canvas-image[data-id="${item.id}"]`) as HTMLElement;
        const offsetX = e.clientX - item.x;
        const offsetY = e.clientY - item.y;
        el.style.zIndex = String(++zSeq);
        return { el, offsetX, offsetY, item };
      });

      const handleMouseMove = (moveEvent: MouseEvent) => {
        draggedData.forEach(({ el, offsetX, offsetY }) => {
          const x = moveEvent.clientX - offsetX;
          const y = moveEvent.clientY - offsetY;
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
        });
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        const newPositions = draggedData.map(({ el, item }) => {
          const x = parseFloat(el.style.left || "0");
          const y = parseFloat(el.style.top || "0");
          return { id: item.id, x, y };
        });
        moveImage$.next({ moves: newPositions });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    // Handle canvas click to deselect all
    const handleCanvasClick = (e: MouseEvent) => {
      // Only deselect if clicking directly on canvas (not on an image)
      if (e.target === e.currentTarget) {
        const currentImages = props.images$.value;
        const updatedImages = currentImages.map((img) => ({ ...img, isSelected: false }));
        props.images$.next(updatedImages);
      }
    };

    // Handle paste event
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const src = e.target?.result as string;
              pasteImage$.next(src);
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    // Handle keydown event for delete/backspace
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        const hasSelected = props.images$.value.some((img) => img.isSelected);
        if (hasSelected) {
          event.preventDefault();
          deleteSelected$.next();
        }
      }
    };

    // Template
    const template$ = props.images$.pipe(
      map(
        (images) => html`
          <div class="canvas" tabindex="0" @paste=${handlePaste} @click=${handleCanvasClick} @keydown=${handleKeyDown}>
            ${images.map(
              (image) => html`
                <div
                  class="canvas-image ${image.isSelected ? "selected" : ""}"
                  data-id="${image.id}"
                  style="left: ${image.x}px; top: ${image.y}px; width: ${image.width}px; height: ${image.height}px;"
                  @mousedown=${(e: MouseEvent) => handleMouseDown(image, e)}
                >
                  <img src="${image.src}" alt="Pasted image" />
                </div>
              `,
            )}
          </div>
        `,
      ),
    );

    // Combine template with effects
    return template$.pipe(
      mergeWith(
        pasteEffect$.pipe(ignoreElements()),
        moveEffect$.pipe(ignoreElements()),
        deleteEffect$.pipe(ignoreElements()),
      ),
    );
  },
);
