import NextDocument, { Head, Html, Main, NextScript } from "next/document";

export default function Document({ __NEXT_DATA__, nonce } = {}) {
  const privatePage = __NEXT_DATA__?.page !== "/auth/signin";
  return (
    <Html>
      <Head nonce={nonce}>
        <meta name="mobile-web-app-capable" content="yes" />
        {privatePage && (
          <>
            <link rel="manifest" href="/site.webmanifest?v=4" crossOrigin="use-credentials" />
            <link rel="preload" href="/api/config/custom.css" as="style" />
            <link rel="stylesheet" href="/api/config/custom.css" /> {/* eslint-disable-line @next/next/no-css-tags */}
          </>
        )}
      </Head>
      <body>
        <Main />
        <NextScript nonce={nonce} />
      </body>
    </Html>
  );
}

Document.getInitialProps = async (context) => ({
  ...(await NextDocument.getInitialProps(context)),
  nonce: context.req?.headers["x-silas-nonce"],
});
