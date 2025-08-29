# Assets Folder

This folder contains all the favicon, social media, and PWA assets for Waveform Studio.

## Required Files

### Main Files (You need to add these)
- **`favicon.svg`** - Primary SVG favicon (recommended size: 32x32 or larger)
- **`og.jpg`** - Open Graph/Social media image (must be 1200x1200, 1:1 aspect ratio)

### Additional Favicon Files (Optional but recommended)
Generate these from your main favicon.svg:
- `favicon-16x16.png` - 16x16 PNG
- `favicon-32x32.png` - 32x32 PNG  
- `apple-touch-icon.png` - 180x180 PNG for iOS
- `android-chrome-192x192.png` - 192x192 PNG for Android
- `android-chrome-512x512.png` - 512x512 PNG for Android
- `mstile-150x150.png` - 150x150 PNG for Windows tiles

## Generated Files (Already created)
- `site.webmanifest` - PWA manifest for app-like behavior
- `browserconfig.xml` - Windows tile configuration

## Quick Setup
1. Add your `favicon.svg` file
2. Add your `og.jpg` social image (1200x1200)
3. Use a favicon generator to create the PNG versions
4. Update the domain URLs in `index.html` meta tags

## Tools for Favicon Generation
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Favicon.io](https://favicon.io/)
- [Figma](https://figma.com) for creating the original assets

## Social Media Image (og.jpg)
- Size: 1200x1200 pixels (1:1 aspect ratio)
- Format: JPG or PNG
- Should represent your app visually
- Will be shown when links are shared on social media