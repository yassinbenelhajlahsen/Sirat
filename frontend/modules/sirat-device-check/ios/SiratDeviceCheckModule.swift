import DeviceCheck
import ExpoModulesCore

public class SiratDeviceCheckModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SiratDeviceCheck")

    Function("isSupported") {
      return DCDevice.current.isSupported
    }

    AsyncFunction("generateToken") { (promise: Promise) in
      DCDevice.current.generateToken { data, error in
        if let data = data {
          promise.resolve(data.base64EncodedString())
        } else {
          promise.reject("ERR_DEVICE_CHECK", error?.localizedDescription ?? "No DeviceCheck token")
        }
      }
    }
  }
}
