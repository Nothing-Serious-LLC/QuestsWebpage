# Download page routing

Elliott authorized publishing this routing fix on October 31, 2026 after a desktop invitation QR opened the old scan page on his phone.

`/share` now loads the shared device router. iPhone and iPad navigate to the App Store. Android navigates to Google Play. Desktop visitors retain the QR and both explicit store choices. Store badges remain available if a phone browser prevents automatic navigation.

The QR destination is `https://thequestsapp.com/share?v=2`. The version query avoids the old scan page already cached on a phone. QR generation is self-hosted and includes no phone number or credential.

Validation: `node --test tests/download-routing.test.mjs` covers iPhone Safari, iPhone Chrome, iPad desktop mode, Android Chrome, desktop behavior, source wiring and the generated QR. The broader site suite and SEO checker also pass in the working branch. Production HTML and JavaScript content types must be read back after GitHub Pages completes its deployment. A physical phone opening its native store remains a separate runtime observation.

This release contains the download page, its shared router, QR asset, styling, generator dependencies and tests. Invitation card layout and animation changes remain in local review.
