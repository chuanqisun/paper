import { html } from "lit-html";
import { BehaviorSubject, Subject, ignoreElements, map, mergeWith, tap } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import "./canvas.component.css";

export interface ImageItem {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CanvasComponent = createComponent((props: { images$: BehaviorSubject<ImageItem[]> }) => {
  // Internal state
  // Local z-index sequence for ephemeral drag stacking without re-render
  let zSeq = 0;

  // Actions
  const pasteImage$ = new Subject<string>();
  const moveImage$ = new Subject<{ id: string; x: number; y: number }>();

  // Effects
  const pasteEffect$ = pasteImage$.pipe(
    tap((src) => {
      const newImage: ImageItem = {
        id: `img-${Date.now()}`,
        src,
        x: Math.random() * 400, // Random position
        y: Math.random() * 400,
        width: 200,
        height: 200,
      };
      props.images$.next([...props.images$.value, newImage]);
    }),
  );

  const moveEffect$ = moveImage$.pipe(
    tap(({ id, x, y }) => {
      // Persist new position and bring the interacted image to top by reordering to the end
      const current = props.images$.value;
      const moved = current.find((img) => img.id === id);
      if (!moved) return;
      const others = current.filter((img) => img.id !== id);
      const updatedMoved = { ...moved, x, y } as ImageItem;
      props.images$.next([...others, updatedMoved]);
    }),
  );

  const handleMouseDown = (image: ImageItem, e: MouseEvent) => {
    const element = e.currentTarget as HTMLElement;
    const startX = e.clientX - element.offsetLeft;
    const startY = e.clientY - element.offsetTop;

    // Elevate this element above others immediately on interaction
    element.style.zIndex = String(++zSeq);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const x = moveEvent.clientX - startX;
      const y = moveEvent.clientY - startY;
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      const rect = element.parentElement?.getBoundingClientRect();
      if (rect) {
        const x = parseFloat(element.style.left || "0");
        const y = parseFloat(element.style.top || "0");
        moveImage$.next({ id: image.id, x, y });
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
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

  // Template
  const template$ = props.images$.pipe(
    map(
      (images) => html`
        <div class="canvas" tabindex="0" @paste=${handlePaste}>
          ${images.map(
            (image) => html`
              <div
                class="canvas-image"
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
  return template$.pipe(mergeWith(pasteEffect$.pipe(ignoreElements()), moveEffect$.pipe(ignoreElements())));
});
