import storage
import usb_cdc
import usb_hid

usb_cdc.enable(console=True, data=True)
usb_hid.enable((usb_hid.Device.KEYBOARD,))
storage.enable_usb_drive()
