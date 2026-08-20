# Paper figure update TODO

Source checked: [arXiv:2608.17975v1](https://arxiv.org/abs/2608.17975v1), submitted on 2026-08-18.

The page copy and captions now follow the paper. The following website images still need to be replaced with the corresponding figures from the latest arXiv HTML/PDF.

## Required replacements

1. Teaser / Figure 1
   - Current: `static/images/teaser-v3.jpg`
   - Latest paper: `teaser-v4.png`
   - Download: <https://arxiv.org/html/2608.17975v1/teaser-v4.png>
   - Save as `static/images/teaser-v4.png`, update the teaser `src` in `index.html`, then remove `teaser-v3.jpg`.

2. Shape Editing / Figure 9
   - Current: `static/images/editing-v2.jpg`
   - Latest paper: `editing-v4.png`
   - Download: <https://arxiv.org/html/2608.17975v1/editing-v4.png>
   - Save as `static/images/editing-v4.png`, update the Shape Editing `src` in `index.html`, then remove `editing-v2.jpg`.

3. High-Fidelity Shape Generation / Figure 10
   - Current: `static/images/High-Fidelity-v1.jpg`
   - Latest paper: `High-Fidelity-v3.png`
   - Download: <https://arxiv.org/html/2608.17975v1/High-Fidelity-v3.png>
   - Save as `static/images/High-Fidelity-v3.png`, update the first Applications card `src` in `index.html`, then remove `High-Fidelity-v1.jpg`.

4. Scene Generation / Figure 11
   - Current: `static/images/image2scene-v1.jpg`
   - Latest paper: `Scene-Level-v4.png`
   - Download: <https://arxiv.org/html/2608.17975v1/Scene-Level-v4.png>
   - Save as `static/images/Scene-Level-v4.png`, update the second Applications card `src` in `index.html`, then remove `image2scene-v1.jpg`.

## Already aligned with the latest paper

- `static/images/DSL-v4.jpg` matches the content of the paper's `DSL-v4.png`; replacement is optional if a lossless PNG is preferred.
- `static/images/overview-v5.png` corresponds to the paper's `overview-v5.svg`; replacement is optional if the vector source is preferred.

## Optional paper-figure view for articulation

The website currently presents six articulation videos, while Figure 7 in the paper is `Articulation-v4.png`. Keep the videos for richer results, or download <https://arxiv.org/html/2608.17975v1/Articulation-v4.png> and add it above the video grid if the project page should reproduce the paper figure exactly.

## Cleanup after replacement

- Remove every superseded image after its new file is referenced.
- Run a local link check and confirm that every file under `static/` is referenced by `index.html`, CSS, or JavaScript.
