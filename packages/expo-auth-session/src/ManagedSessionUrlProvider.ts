import Constants from 'expo-constants';
import qs from 'qs';

import { SessionUrlProvider } from './SessionUrlProvider';

const { manifest } = Constants;

export class ManagedSessionUrlProvider implements SessionUrlProvider {
  private static readonly BASE_URL = `https://auth.expo.io`;
  private static readonly SESSION_PATH = 'expo-auth-session';
  private static readonly USES_CUSTOM_SCHEME =
    Constants.appOwnership === 'standalone' && manifest.scheme;
  private static readonly HOST_URI = ManagedSessionUrlProvider.getHostUri();
  private static readonly IS_EXPO_HOSTED =
    ManagedSessionUrlProvider.HOST_URI &&
    (/^(.*\.)?(expo\.io|exp\.host|exp\.direct|expo\.test)(:.*)?(\/.*)?$/.test(
      ManagedSessionUrlProvider.HOST_URI
    ) ||
      manifest.developer);

  getDefaultReturnUrl(urlPath?: string): string {
    let scheme = 'exp';
    let path = ManagedSessionUrlProvider.SESSION_PATH;
    const manifestScheme = manifest.scheme || (manifest.detach && manifest.detach.scheme);

    if (Constants.appOwnership === 'standalone' && manifestScheme) {
      scheme = manifestScheme;
    } else if (Constants.appOwnership === 'standalone' && !manifestScheme) {
      throw new Error(
        'Cannot make a deep link into a standalone app with no custom scheme defined'
      );
    } else if (Constants.appOwnership === 'expo' && !manifestScheme) {
      console.warn(
        'Linking requires that you provide a `scheme` in app.json for standalone apps - if it is left blank, your app may crash. The scheme does not apply to development in the Expo client but you should add it as soon as you start working with Linking to avoid creating a broken build. Add a `scheme` to silence this warning. Learn more about Linking at https://docs.expo.io/versions/latest/workflow/linking/'
      );
    }

    let hostUri = ManagedSessionUrlProvider.HOST_URI || '';
    if (ManagedSessionUrlProvider.USES_CUSTOM_SCHEME && ManagedSessionUrlProvider.IS_EXPO_HOSTED) {
      hostUri = '';
    }

    if (path) {
      if (ManagedSessionUrlProvider.IS_EXPO_HOSTED && hostUri) {
        path = `/--/${ManagedSessionUrlProvider.removeLeadingSlash(path)}`;
      }

      if (!path.startsWith('/')) {
        path = `/${path}`;
      }
    } else {
      path = '';
    }

    if (urlPath) {
      path = [path, urlPath].filter(Boolean).join('/');
    }

    hostUri = ManagedSessionUrlProvider.removeTrailingSlash(hostUri);

    return encodeURI(`${scheme}://${hostUri}${path}`);
  }

  getStartUrl(authUrl: string, returnUrl: string): string {
    const queryString = qs.stringify({
      authUrl,
      returnUrl,
    });

    return `${this.getRedirectUrl()}/start?${queryString}`;
  }

  getRedirectUrl(): string {
    const redirectUrl = `${ManagedSessionUrlProvider.BASE_URL}/${manifest.id}`;
    if (__DEV__) {
      ManagedSessionUrlProvider.warnIfAnonymous(manifest.id, redirectUrl);
    }
    return redirectUrl;
  }

  static getHostUri(): string {
    let hostUri = manifest.hostUri;
    if (!hostUri && !ManagedSessionUrlProvider.USES_CUSTOM_SCHEME) {
      // we're probably not using up-to-date xdl, so just fake it for now
      // we have to remove the /--/ on the end since this will be inserted again later
      hostUri = ManagedSessionUrlProvider.removeScheme(Constants.linkingUri).replace(
        /\/--(\/.*)?$/,
        ''
      );
    }

    return hostUri;
  }

  private static warnIfAnonymous(id, url): void {
    if (id.startsWith('@anonymous/')) {
      console.warn(
        `You are not currently signed in to Expo on your development machine. As a result, the redirect URL for AuthSession will be "${url}". If you are using an OAuth provider that requires whitelisting redirect URLs, we recommend that you do not whitelist this URL -- instead, you should sign in to Expo to acquired a unique redirect URL. Additionally, if you do decide to publish this app using Expo, you will need to register an account to do it.`
      );
    }
  }

  private static removeScheme(url: string) {
    return url.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
  }

  private static removeLeadingSlash(url: string) {
    return url.replace(/^\//, '');
  }

  private static removeTrailingSlash(url: string) {
    return url.replace(/\/$/, '');
  }
}
