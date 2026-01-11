"use client";

import Script from "next/script";

export default function TikTokPixel({ pixelId }: { pixelId: string }) {
  if (!pixelId) return null;

  return (
    <Script
      id="tiktok-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;
  var ttq=w[t]=w[t]||[];
  ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
  ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
  for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
  ttq.instance=function(t){for(var e=ttq._i||[],n=0;n<e.length;n++)if(e[n].id===t)return e[n];return null};
  ttq.load=function(e,n){
    var i="https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i=ttq._i||[];
    ttq._i.push({id:e, options:n});
    var o=d.createElement("script");
    o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;
    var a=d.getElementsByTagName("script")[0];
    a.parentNode.insertBefore(o,a);
  };
  ttq.load("D5HMVMRC77UA3NVKE3G0");
  ttq.page();
}(window, document, 'ttq');
        `,
      }}
    />
  );
}