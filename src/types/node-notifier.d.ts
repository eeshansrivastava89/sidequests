declare module "node-notifier" {
  interface Notification {
    title?: string;
    message?: string;
    sound?: boolean | string;
    wait?: boolean;
    timeout?: number;
    appID?: string;
  }

  function notify(options: Notification, callback?: (err: Error | null, response: string | null) => void): void;

  export { notify };
  export default { notify };
}