<script>
import { reportError } from './core/logger.js'
export default {
  onError(error) {
    reportError('app', error)
  },
  onUnhandledRejection(event) {
    reportError('promise', event.reason)
  },
}
</script>
<style lang="scss">
@import 'uview-plus/index.scss';
@import './styles/app.scss';
</style>
