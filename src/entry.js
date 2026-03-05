import { createApp, reactive } from 'vue';
import App from './App.vue';


const COMPONENT_NAME = 'hosts_alarms';

const api = {

  mount(el, opts = {}) {
    const { conf, context, zbx } = opts;
    const widgetState = reactive({
      conf: conf ?? {},
      context: context ?? {},
      zbx: zbx ?? {}
    });

    const app = createApp(App, { conf, context, zbx });
    app.provide('widgetState', widgetState);
    app.mount(el);

    return {
      destroy() {
        app.unmount();
      },
      // Wrapper calls update(payload) without remount
      update(payload = {}) {

        widgetState.conf = payload.conf ?? {};
        widgetState.context = payload.context ?? {};
        widgetState.zbx = payload.zbx ?? {};
      }
    };
  },
};

// Publish as window.hosts_alarms (or whatever COMPONENT_NAME is)
window[COMPONENT_NAME] = api;
