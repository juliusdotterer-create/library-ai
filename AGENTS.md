<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project architecture

- Keep the mobile primary navigation in `AppShell` as a route-derived four-column control with one shared Motion lens, so visual state cannot diverge from navigation state.
- Keep `PdfCanvasViewer` zoom controlled by its parent so document-specific views can persist their own zoom preference.
