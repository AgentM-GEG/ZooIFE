/**
 * Version utilities - exposes app version for use throughout the app
 * 
 * The version is injected at build-time from package.json by Vite.
 * It follows the format "IFE-<semver>" where <semver> is from package.json.
 */

declare const __APP_VERSION__: string;

/**
 * Current app version in format "IFE-x.x.x"
 * Determined from package.json at build time
 * @example "IFE-0.1.0"
 */
export const APP_VERSION = `IFE-${__APP_VERSION__}`;

/**
 * Raw semantic version from package.json (without "IFE-" prefix)
 * @example "0.1.0"
 */
export const APP_VERSION_SEMVER = __APP_VERSION__;
