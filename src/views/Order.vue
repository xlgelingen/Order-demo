<script setup>
import { ref, onMounted, computed } from 'vue'
import { useStore } from '@/stores/index.js'
import { useRoute } from 'vue-router'
import router from '@/router'
import { ElMessage } from 'element-plus'
import TheAvatar from '@/components/TheAvatar.vue'
import MessageBox from '@/components/MessageBox.vue'
import { goPage } from '@/utils/routes'
import TheLoadingImage from '@/components/TheLoadingImage.vue'
import orderService from 'service/order'
import {
  PAY_STATUS_PENDING,
  PAY_STATUS_SUCCESS,
  PAY_STATUS_FAILED,
  ORDER_TYPE_COURSE,
  ORDER_TYPE_COURSE_SERIES,
  ORDER_TYPE_VIP,
  PAY_METHOD_WECHAT,
  PAY_METHOD_ALIPAY,
  PAY_METHOD_HEART
} from '@/utils/const'
import userService from 'service/user'
import courseService from 'service/course'
import vipService from 'service/vip'
import Countdown from '@/components/Countdown.vue'
import CAUTION_IMG from 'images/caution.png'
const store = useStore()
const route = useRoute()
const userInfo = computed(() => store.userInfo)
const loading = ref(true)
const payment = ref(null)
const order = ref({
  resource: {}
})
const isShowMessageBox = ref(false)
const msgBoxData = ref({})
const showWechatQrcode = ref(false)
const showStatus = ref(false)
const routeCountDown = ref(5)
const status = ref(PAY_STATUS_PENDING)
const wechatQrcode = ref(null)
const heartVisible = ref(false)
onMounted(() => {
  getData()
})
function getData() {
  let { resourceType, resourceId } = route.params
  resourceType = resourceType - 0
  let promiseArr = []
  switch (resourceType) {
    case ORDER_TYPE_COURSE:
      promiseArr.push(courseService.course(resourceId))
      break
    case ORDER_TYPE_COURSE_SERIES:
      promiseArr.push(courseService.series(resourceId))
      break
    case ORDER_TYPE_VIP:
      promiseArr.push(vipService.vipSku(resourceId))
      break
  }
  if (promiseArr.length < 1) {
    return goPage('NotFound')
  }
  promiseArr.push(orderService.order(resourceType, resourceId))
  Promise.all(promiseArr)
    .then(([resource, orderRes]) => {
      order.value = {
        type: resourceType,
        resource_id: resourceId,
        total_amount: resource.current_price,
        real_total_amount: resource.current_price,
        total_heart_count: resource.heart_count || 0,
        resource: {
          ...resource,
          price: resource.current_price
        },
        ...orderRes
      }
      status.value = orderRes?.status || PAY_STATUS_PENDING
    })
    .finally(() => {
      loading.value = false
    })
}
function getOrderNo() {
  const { no, type, resource_id, resource } = order.value
  if (no) {
    return Promise.resolve({
      no
    })
  }
  return orderService.addOrder({
    type,
    resource_id,
    remark: resource.name + ' 购买'
  })
}
function handlePay() {
  if (!payment.value) {
    ElMessage({
      message: `请选择支付方式`,
      type: 'warning'
    })
    return
  }
  getOrderNo().then((orderRes) => {
    const { no } = orderRes
    order.value = {
      ...order.value,
      ...orderRes
    }
    switch (payment.value) {
      case PAY_METHOD_WECHAT:
        loading.value = true
        orderService
          .payByWechat(no)
          .then((res) => {
            wechatQrcode.value = res.qrcode
            showWechatQrcode.value = true
            handlePayCheck()
          })
          .finally(() => {
            loading.value = false
          })
        break
      case PAY_METHOD_ALIPAY:
        orderService.payByAlipay(no, {
          return_url: getAlipayReturnUrl()
        })
        handlePayCheck(true)
        break
      case PAY_METHOD_HEART:
        if (order.value.total_heart_count > userInfo.value.mark_total) {
          heartVisible.value = true
          return
        } else {
          handleConfirmVisible()
        }
        break
      default:
        break
    }
  })
}
function handlePayCheck(show = false, once = false) {
  const { no } = order.value
  orderService.orderCheck(no).then((res) => {
    if (res.status === PAY_STATUS_SUCCESS) {
      showWechatQrcode.value = false
      status.value = PAY_STATUS_SUCCESS
      showStatus.value = true
      routeCountDown.value = 5
      const timer = setInterval(() => {
        routeCountDown.value--
        if (routeCountDown.value <= 0) {
          handleSuccess()
          clearInterval(timer)
        }
      }, 1000)
    } else if (res.status === PAY_STATUS_FAILED) {
      showWechatQrcode.value = false
      status.value = PAY_STATUS_FAILED
      showStatus.value = true
    } else {
      if (show) {
        showStatus.value = true
      }
      status.value = PAY_STATUS_PENDING
      if ((showWechatQrcode.value || showStatus.value) && !once) {
        const timer = setTimeout(() => {
          handlePayCheck()
          clearTimeout(timer)
        }, 1000 * 1)
      }
    }
  })
}
function handleStatusClick() {
  if (status.value === PAY_STATUS_FAILED) {
    showStatus.value = false
    status.value = PAY_STATUS_PENDING
  } else if (status.value === PAY_STATUS_SUCCESS) {
    handleSuccess()
  } else {
    handlePayCheck(false, true)
  }
}
function handleSuccess() {
  switch (order.value.type) {
    case ORDER_TYPE_COURSE:
      goPage('AcademyCourseDetail', { id: order.value.resource.id })
      break
    case ORDER_TYPE_COURSE_SERIES:
      goPage('AcademySeriesDetail', { id: order.value.resource.id })
      break
    case ORDER_TYPE_VIP:
      userService.getUserInfo().then((userInfo) => {
        store.USERINFO({ ...userInfo })
      })
      goPage('MyPurchase', null, null, 'replace')
      break
    default:
      break
  }
}
function getAlipayReturnUrl() {
  const { type } = order.value
  let url = window.location.protocol + '//' + window.location.host
  switch (type) {
    case ORDER_TYPE_COURSE:
      url += router.resolve({
        name: 'AcademyCourseDetail',
        params: {
          id: order.value.resource.id
        }
      }).href
      break
    case ORDER_TYPE_COURSE_SERIES:
      url += router.resolve({
        name: 'AcademySeriesDetail',
        params: {
          id: order.value.resource.id
        }
      }).href
      break
    case ORDER_TYPE_VIP:
      url += router.resolve({
        name: 'MyPurchase'
      }).href
      break
    default:
      break
  }
  return url
}
function handleCancelVisible() {
  msgBoxData.value = {
    img: CAUTION_IMG,
    imgWidth: 150,
    imgHeight: 150,
    width: 670,
    showCloseBtn: false,
    content: `<p style='color:#2C3330;font-size:20px;line-height:28px;font-weight:600; margin-top: 8px;'>确认取消该笔订单？</p>`,
    confirmBtnText: '确认取消',
    cancelBtnText: '等等',
    showCancelBtn: true,
    maskCancel: false,
    confirm: handleCancel,
    cancelMethod: handleCloseMsgBox
  }
  isShowMessageBox.value = true
}
function handleCloseMsgBox() {
  msgBoxData.value = {}
  isShowMessageBox.value = false
}
function handleCancel() {
  orderService
    .cancelOrder(order.value.no)
    .then(() => {
      ElMessage({
        message: `订单已经取消`,
        type: 'success'
      })
    })
    .finally(() => {
      msgBoxData.value = {}
      isShowMessageBox.value = false
      setTimeout(() => {
        goPage('MyPurchase')
      }, 1000)
    })
}
function handleConfirmVisible() {
  msgBoxData.value = {
    img: CAUTION_IMG,
    imgWidth: 150,
    imgHeight: 150,
    width: 670,
    showCloseBtn: false,
    content: `<p style='color:#2C3330;font-size:20px;line-height:28px;font-weight:600; margin-top: 8px;'>是否花费${order.value.total_heart_count}暖心兑换课程？</p>`,
    confirmBtnText: '确认兑换',
    cancelBtnText: '等等',
    showCancelBtn: true,
    maskCancel: false,
    confirm: handleConfirm,
    cancelMethod: handleCloseMsgBox
  }
  isShowMessageBox.value = true
}
function handleConfirm() {
  orderService.payByHeart(order.value.no).then(() => {
    ElMessage({
      message: `${[PAY_METHOD_HEART].indexOf(payment.value) > -1 ? '兑换' : '支付'}成功`,
      type: 'success'
    })
    setTimeout(() => {
      msgBoxData.value = {}
      isShowMessageBox.value = false
      handleSuccess()
    }, 1000)
  })
}
</script>
<template>
  <div v-loading="loading" class="page">
    <div class="page-header">
      <div class="page-header-left">
        <i class="page-header-logo" @click="() => goPage('Home', null, null, '_blank')"></i>
        <h4 class="page-header-title">结算台</h4>
      </div>
      <div class="page-header-right">
        <the-avatar :size="32" :url="userInfo.avatar_url" />
      </div>
    </div>
    <div class="page-content">
      <div class="container-1180">
        <div class="page-content-commodity">
          <div
            v-if="order.no && status === PAY_STATUS_PENDING"
            class="page-content-tips common-ladder-1"
          >
            订单号：{{ order.no }} 请在<Countdown
              class="countdown"
              :created-time="
                new Date(order.created_at && order.created_at).valueOf() + 24 * 60 * 60 * 1000
              "
              :show-unit-text="false"
              @update="order.cancel_status = 1"
            ></Countdown
            >内完成支付，超时订单将自动关闭
            <span @click="handleCancelVisible()">取消订单</span>
          </div>
          <h4 class="page-content-title">商品信息</h4>
          <ul class="commodity-table">
            <li class="table-th">
              <label v-if="order.resource.cover_url" class="tb-pic">商品图</label>
              <label class="tb-name">商品名称</label>
              <label class="tb-type">类型</label>
              <label class="tb-price">单价</label>
              <label class="tb-count">数量</label>
              <label class="tb-sum">小计</label>
            </li>
            <li class="table-tr">
              <the-loading-image
                v-if="order.resource.cover_url"
                class="tb-pic"
                :width="80"
                :height="80"
                :url="order.resource.cover_url"
              />
              <label class="tb-name">
                <span class="commodity-name">{{ order.resource.name }}</span>
                <!-- <span class="commodity-time"
                      v-if=" order.type === ORDER_TYPE_COURSE">开课时间：2021年5月21日</span> -->
              </label>
              <label class="tb-type">{{
                order.type === ORDER_TYPE_COURSE
                  ? '视频课'
                  : order.type === ORDER_TYPE_COURSE_SERIES
                    ? '系列课'
                    : order.type === ORDER_TYPE_VIP
                      ? 'VIP'
                      : '其他'
              }}</label>
              <label class="tb-price">
                <template v-if="order.resource.price > 0"> ¥{{ order.resource.price }} </template>
                <label v-if="order.total_heart_count" class="tb-price-heart">
                  <template v-if="order.resource.price > 0">或</template>
                  {{ order.total_heart_count }} <i class="heart-icon"></i>
                </label>
              </label>
              <label class="tb-count">1</label>
              <label class="tb-sum">¥{{ order.total_amount }}</label>
            </li>
          </ul>
        </div>
        <div class="page-content-pay">
          <h4 class="page-content-title">支付方式</h4>
          <div class="pay-list">
            <el-radio
              v-if="order.real_total_amount > 0"
              v-model="payment"
              class="pay-item"
              :label="PAY_METHOD_ALIPAY"
            >
              <div class="pay-item-left">
                <i class="alipay-icon"></i>
                <span class="pay-item-name">支付宝</span>
              </div>
            </el-radio>
            <el-radio
              v-if="order.real_total_amount > 0"
              v-model="payment"
              class="pay-item"
              :label="PAY_METHOD_WECHAT"
            >
              <div class="pay-item-left">
                <i class="wechat-icon"></i>
                <span class="pay-item-name">微信</span>
              </div>
            </el-radio>
            <el-radio
              v-if="order.total_heart_count > 0"
              v-model="payment"
              class="pay-item"
              :label="PAY_METHOD_HEART"
            >
              <div class="pay-item-left">
                <i class="heart-icon"></i>
                <span class="pay-item-name">使用暖心兑换</span>
              </div>
            </el-radio>
          </div>
        </div>
      </div>
    </div>
    <div class="page-footer">
      <div class="page-footer-price">
        <template v-if="[PAY_METHOD_WECHAT, PAY_METHOD_ALIPAY].indexOf(payment) > -1">
          <span class="total">¥{{ order.real_total_amount }}</span>
          <span class="unit">元</span>
        </template>
        <template v-else-if="[PAY_METHOD_HEART].indexOf(payment) > -1">
          <span class="desc">暖心兑换</span>
          <span class="total">{{ order.total_heart_count }}</span>
          <i class="heart-icon"></i>
        </template>
      </div>
      <div class="page-footer-btn" @click="handlePay">
        立即{{
          [PAY_METHOD_HEART].indexOf(payment) > -1 ||
          (order.total_heart_count > 0 && order.real_total_amount == 0)
            ? '兑换'
            : '支付'
        }}
      </div>
    </div>
    <el-dialog v-model="showWechatQrcode" width="360px" :show-close="false">
      <img :src="wechatQrcode" />
    </el-dialog>
    <el-dialog v-model="showStatus" class="status-dialog" width="380px" :show-close="false">
      <div class="status-dialog-top">
        <i
          :class="[
            status === PAY_STATUS_SUCCESS
              ? 'success-icon'
              : status === PAY_STATUS_FAILED
                ? 'fail-icon'
                : 'pending-icon'
          ]"
        ></i>
        <h4 class="status-title">
          {{
            status === PAY_STATUS_SUCCESS
              ? '支付成功'
              : status === PAY_STATUS_FAILED
                ? '支付失败'
                : '等待支付中...'
          }}
        </h4>
        <p v-if="status !== PAY_STATUS_PENDING" class="status-tips">
          {{ PAY_STATUS_SUCCESS ? routeCountDown + 's 后跳转' : '请检查订单支付状态' }}
        </p>
      </div>
      <div
        :class="['status-btn', status === PAY_STATUS_FAILED ? 'fail' : '']"
        @click="handleStatusClick"
      >
        {{
          status === PAY_STATUS_SUCCESS
            ? '手动跳转'
            : status === PAY_STATUS_FAILED
              ? '返回结算台'
              : '我已支付'
        }}
      </div>
    </el-dialog>
    <el-dialog v-model="heartVisible" class="heart-dialog" @close="heartVisible = false">
      <img src="~/images/order/close.svg" class="close" @click="heartVisible = false" />
      <img src="~/images/order/apply-dialog-heart-disabeld.svg" class="body__img" />
      暖心不足了 T T。<el-link
        class="body__description--green"
        :href="'https://daylab.feishu.cn/docs/doccnohbPVyA9FFaZG2EOp7Zs2d#NnQIoF'"
        target="_blank"
      >
        <img src="~/images/order/info.svg" class="info-icon" />
        去看看如何获取暖心
      </el-link>
      <div class="btn">
        <div class="button" @click="heartVisible = false">我知道了</div>
      </div>
    </el-dialog>
  </div>
  <MessageBox
    v-if="isShowMessageBox"
    :width="msgBoxData.width"
    :height="msgBoxData.height"
    :img="msgBoxData.img"
    :img-width="msgBoxData.imgWidth"
    :img-height="msgBoxData.imgHeight"
    :content="msgBoxData.content"
    :notification-count="msgBoxData.notificationCount"
    :show-widget-notification="msgBoxData.showWidgetNotification"
    :show-close-btn="msgBoxData.showCloseBtn"
    :show-cancel-btn="msgBoxData.showCancelBtn"
    :show-confirm-btn="msgBoxData.showConfirmBtn"
    :cancel-btn-text="msgBoxData.cancelBtnText"
    :confirm-btn-icon="msgBoxData.confirmBtnIcon"
    :confirm-btn-text="msgBoxData.confirmBtnText"
    :body-class="msgBoxData.bodyClass"
    :mask-cancel="msgBoxData.maskCancel"
    @cancel-method="msgBoxData.cancelMethod"
    @confirm="msgBoxData.confirm"
    @close="handleCloseMsgBox"
  />
</template>
<style lang="less" scoped>
.page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #fff;
  .page-header {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 40px;
    height: 80px;
    border-bottom: 1px solid #efefef;
    .page-header-left {
      display: flex;
      align-items: center;
      .page-header-logo {
        display: inline-block;
        width: 168px;
        height: 60px;
        cursor: pointer;
      }
      .page-header-title {
        margin-left: 16px;
        line-height: 20px;
        font-weight: 600;
        font-size: 20px;
        color: #2c3330;
      }
    }
    .page-header-right {
      cursor: pointer;
    }
  }
  .page-content {
    flex: 1;
    padding: 20px 0;
    .page-content-tips {
      display: flex;
      align-items: center;
      padding: 8px 10px;
      margin-bottom: 24px;
      font-size: 16px;
      color: #c6821c;
      background: #f8ecda;
      border: 2px solid#FFB03A;

      .countdown {
        width: fit-content;
        margin: 0;
        padding: 0;
        font-size: 16px;
        color: #d34609;
      }

      span {
        color: #d34609;
        text-decoration: underline;
        cursor: pointer;
      }
    }
    .page-content-title {
      margin-bottom: 24px;
      line-height: 34px;
      font-weight: 600;
      font-size: 24px;
      color: #2c3330;
    }
    .commodity-table {
      .table-th {
        display: flex;
        align-items: center;
        text-align: left;
        padding-bottom: 24px;
        line-height: 20px;
        font-size: 14px;
        color: #81948b;
        border-bottom: 1px solid #efefef;
      }
      .table-tr {
        display: flex;
        align-items: center;
        text-align: left;
        padding: 24px 0;
        line-height: 22px;
        font-size: 16px;
        color: #2c3330;
        border-bottom: 1px solid #efefef;
        .tb-name {
          display: flex;
          flex-direction: column;
          .commodity-name {
            line-height: 22px;
            font-weight: 600;
            font-size: 16px;
            color: #2c3330;
          }
          .commodity-time {
            display: inline-block;
            margin-top: 4px;
            line-height: 17px;
            font-size: 12px;
            color: #81948b;
          }
        }
      }
      .tb-pic {
        width: 80px;
        margin-right: 40px;
      }
      .tb-name {
        width: 460px;
        margin-right: 40px;
      }
      .tb-type,
      .tb-price {
        width: 120px;
        margin-right: 40px;
      }
      .tb-price {
        display: flex;
        flex-direction: column;
        .tb-price-heart {
          display: flex;
          align-items: center;
          line-height: 16px;
          font-weight: 400;
          color: #81948b;
          .heart-icon {
            margin-left: 4px;
            width: 16px;
            height: 16px;
          }
        }
      }
      .tb-count {
        width: 80px;
        margin-right: 40px;
      }
      .tb-sum {
        width: 120px;
      }
    }
    .page-content-pay {
      margin-top: 40px;
      .pay-list {
        display: flex;
        align-items: center;
        justify-content: space-between;
        .pay-item {
          display: flex;
          flex-direction: row-reverse;
          align-items: center;
          justify-content: space-between;
          width: 580px;
          height: auto;
          padding: 19px 29px 19px 19px;
          border: 1px solid #efefef;
          .el-radio__label {
            padding: unset;
          }
          .el-radio__input {
            &:not(.is_checked) {
              border-color: #cccccc;
            }
          }
          .el-radio__inner {
            width: 20px;
            height: 20px;
            border-width: 2px;
            &::after {
              width: 6px;
              height: 6px;
            }
          }
          .pay-item-left {
            display: flex;
            align-items: center;
            .alipay-icon,
            .wechat-icon,
            .heart-icon {
              display: inline-block;
              width: 40px;
              height: 40px;
              margin-right: 16px;
              background-size: cover;
              background-repeat: no-repeat;
            }
            .alipay-icon {
              background-image: url('images/order/alipay.svg');
            }
            .wechat-icon {
              background-image: url('images/order/wechat.svg');
            }
            .pay-item-name {
              line-height: 22px;
              font-size: 16px;
              color: #2c3330;
            }
          }
        }
        :deep(.is-focus),
        .is-checked {
          background-color: #eff9f4;
          border: 1px solid #14af64;
        }
      }
    }
  }

  .page-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    height: 80px;
    background: #14af64;
    .page-footer-price {
      margin-right: 20px;
      color: #fff;
      .desc {
        display: inline-block;
        margin-right: 10px;
        line-height: 19px;
        vertical-align: super;
        font-weight: 400;
        color: #ffffff;
      }
      .total {
        line-height: 50px;
        font-weight: 600;
        font-size: 36px;
      }
      .unit {
        display: inline-block;
        margin-left: 8px;
        line-height: 22px;
        font-size: 16px;
      }
      .heart-icon {
        margin-left: 4px;
      }
    }
    .page-footer-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 370px;
      height: 100%;
      line-height: 34px;
      font-weight: 600;
      font-size: 24px;
      color: #ffffff;
      background: #7a55ff;
      cursor: pointer;
    }
  }
  :deep(.el-dialog) {
    .el-dialog__header {
      display: none;
    }
  }
  :deep(.status-dialog) {
    .el-dialog__body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      height: 269px;
      padding: 40px 0;
      .status-dialog-top {
        display: flex;
        flex-direction: column;
        align-items: center;
        .pending-icon,
        .success-icon,
        .fail-icon {
          display: inline-block;
          width: 40px;
          height: 40px;
          margin-top: 8px;
          background-size: cover;
          background-repeat: no-repeat;
        }
        .pending-icon {
          width: 48px;
          height: 48px;
          margin-top: 0;
          background-image: url('images/order/pending.svg');
        }
        .success-icon {
          background-image: url('images/order/success.svg');
        }
        .fail-icon {
          background-image: url('images/order/fail.svg');
        }
        .status-title {
          margin-top: 16px;
          line-height: 24px;
          font-weight: 600;
          font-size: 24px;
          color: #2c3330;
        }
        .status-tips {
          margin-top: 8px;
          line-height: 17px;
          font-size: 12px;
          color: #81948b;
        }
      }
      .status-btn {
        padding: 7px 23px;
        line-height: 20px;
        font-weight: 600;
        font-size: 14px;
        color: #14af64;
        border: 1px solid #14af64;
        cursor: pointer;
        &.fail {
          color: #2c3330;
          border-color: #2c3330;
        }
      }
    }
  }

  .heart-dialog {
    display: flex;
    align-items: center;
    justify-content: center;

    :deep(.el-dialog) {
      position: relative;
      width: 500px;
      height: 384px;
      margin: 0 !important;
      background: #fff;

      .el-dialog__header {
        display: none;
      }
      .el-dialog__body {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        line-height: 28px;
        height: 100%;
        padding: 0 60px;
        font-size: 20px;
        font-weight: 600;
        color: #2c3330;

        .close {
          position: absolute;
          width: 20px;
          height: 20px;
          right: 12px;
          top: 12px;
          cursor: pointer;
        }

        img {
          width: 150px;
          height: 150px;
          margin-bottom: 8px;
        }

        .body__description--green {
          margin-top: 16px;
          color: #14af64;
          line-height: 28px;

          .el-link--inner {
            display: flex;
            align-items: center;
          }

          .info-icon {
            width: 14px;
            height: 14px;
            margin-right: 4px;
            margin-bottom: 0;
          }
        }

        .btn {
          display: flex;
        }

        .button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 204px;
          height: 50px;
          margin-top: 40px;
          font-size: 16px;
          font-weight: 500;
          color: #ffffff;
          cursor: pointer;
          background-image: url('images/order/btn_bg.svg');
          background-size: cover;
          background-repeat: no-repeat;

          &:active {
            background-image: url('images/order/btn_pressing.svg');
          }
        }
      }
    }
  }

  .heart-icon {
    display: inline-block;
    width: 24px;
    height: 24px;
    background-image: url('images/heart.svg');
    background-size: cover;
    background-repeat: no-repeat;
  }
}

@media screen and (max-width: 1214px) {
  .container-1180 {
    width: 100% !important;
    padding: 0 40px;
  }
}
</style>
